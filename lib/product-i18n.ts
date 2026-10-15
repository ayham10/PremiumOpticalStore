import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  looksUntranslated,
  mapPool,
  translateText,
  type TranslateTextFn,
  type TranslationFailure,
} from "@/lib/translate-text";

export const PRODUCT_CONTENT_LOCALES: readonly Locale[] = ["ar", "he", "en"];

export type ProductI18nField = "name" | "description" | "color";
export type ProductCopyOrigin = "source" | "machine" | "manual";

export const PRODUCT_I18N_FIELDS: readonly ProductI18nField[] = [
  "name",
  "description",
  "color",
];

export interface ProductLocaleCopy {
  name?: string;
  description?: string;
  color?: string;
  origins?: Partial<Record<ProductI18nField, ProductCopyOrigin>>;
}

export type ProductLocales = Partial<Record<Locale, ProductLocaleCopy>>;

export interface ProductI18nFields {
  name: string;
  description: string;
  color?: string;
  locales?: ProductLocales;
  i18nSource?: Locale;
}

export const MANUAL_TRANSLATIONS_CODE = "MANUAL_TRANSLATIONS";

function trimCopy(value: string | undefined): string {
  return (value || "").trim();
}

export function emptyProductCopy(): ProductLocaleCopy {
  return { name: "", description: "", color: "", origins: {} };
}

export function sanitizeProductLocales(input: unknown): ProductLocales {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const next: ProductLocales = {};
  for (const locale of PRODUCT_CONTENT_LOCALES) {
    const row = raw[locale];
    if (!row || typeof row !== "object") continue;
    const copy = row as ProductLocaleCopy;
    const origins: ProductLocaleCopy["origins"] = {};
    const originRaw = copy.origins;
    if (originRaw && typeof originRaw === "object") {
      for (const field of PRODUCT_I18N_FIELDS) {
        const origin = originRaw[field];
        if (origin === "source" || origin === "machine" || origin === "manual") {
          origins[field] = origin;
        }
      }
    }
    next[locale] = {
      name: trimCopy(copy.name),
      description: trimCopy(copy.description),
      color: trimCopy(copy.color) || undefined,
      origins,
    };
  }
  return next;
}

export function resolveProductCopy(
  product: ProductI18nFields,
  locale: string | undefined,
): { name: string; color?: string; description: string } {
  const locales = sanitizeProductLocales(product.locales);
  const wanted = isLocale(locale) ? locale : undefined;
  const fallbacks: Array<ProductLocaleCopy | undefined> = [
    wanted ? locales[wanted] : undefined,
    product.i18nSource ? locales[product.i18nSource] : undefined,
    locales.ar,
    {
      name: product.name,
      description: product.description,
      color: product.color,
    },
  ];
  const name =
    fallbacks.map((row) => trimCopy(row?.name)).find(Boolean) || product.name || "";
  const description =
    fallbacks.map((row) => trimCopy(row?.description)).find(Boolean) ||
    product.description ||
    "";
  const color =
    fallbacks.map((row) => trimCopy(row?.color)).find(Boolean) ||
    trimCopy(product.color) ||
    undefined;
  return { name, description, color };
}

export function withProductLocale<T extends ProductI18nFields>(
  product: T,
  locale: string | undefined,
): T {
  const copy = resolveProductCopy(product, locale);
  return {
    ...product,
    name: copy.name,
    description: copy.description,
    color: copy.color,
  };
}

export function productSearchText(product: ProductI18nFields): string {
  const locales = sanitizeProductLocales(product.locales);
  const parts = [
    product.name,
    product.description,
    product.color,
    ...PRODUCT_CONTENT_LOCALES.flatMap((locale) => {
      const row = locales[locale];
      return row ? [row.name, row.description, row.color] : [];
    }),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function copyFromFields(
  fields: { name: string; description: string; color?: string },
  origin: ProductCopyOrigin,
): ProductLocaleCopy {
  const color = trimCopy(fields.color);
  return {
    name: trimCopy(fields.name),
    description: trimCopy(fields.description),
    color: color || undefined,
    origins: {
      name: origin,
      description: origin,
      ...(color ? { color: origin } : {}),
    },
  };
}

function fieldOrigin(
  copy: ProductLocaleCopy | undefined,
  field: ProductI18nField,
): ProductCopyOrigin | undefined {
  return copy?.origins?.[field];
}

function fieldValue(copy: ProductLocaleCopy | undefined, field: ProductI18nField): string {
  if (field === "color") return trimCopy(copy?.color);
  return trimCopy(copy?.[field]);
}

export function wouldOverwriteManual(opts: {
  existing?: ProductI18nFields;
  sourceLocale: Locale;
  fields: { name: string; description: string; color?: string };
}): ProductI18nField[] {
  const existingLocales = sanitizeProductLocales(opts.existing?.locales);
  const previous = existingLocales[opts.sourceLocale];
  const blocked: ProductI18nField[] = [];
  for (const field of PRODUCT_I18N_FIELDS) {
    const nextValue =
      field === "color"
        ? trimCopy(opts.fields.color)
        : trimCopy(opts.fields[field]);
    const prevValue = previous
      ? fieldValue(previous, field)
      : field === "color"
        ? trimCopy(opts.existing?.color)
        : trimCopy(opts.existing?.[field]);
    if (nextValue === prevValue) continue;
    const hits = PRODUCT_CONTENT_LOCALES.some((locale) => {
      if (locale === opts.sourceLocale) return false;
      return fieldOrigin(existingLocales[locale], field) === "manual";
    });
    if (hits) blocked.push(field);
  }
  return blocked;
}

export class ManualTranslationError extends Error {
  fields: ProductI18nField[];
  constructor(fields: ProductI18nField[]) {
    super(MANUAL_TRANSLATIONS_CODE);
    this.name = "ManualTranslationError";
    this.fields = fields;
  }
}

export async function applyProductTranslations(opts: {
  existing?: ProductI18nFields;
  sourceLocale: Locale;
  fields: { name: string; description: string; color?: string };
  drafts?: ProductLocales;
  overwriteManual?: boolean;
  translate?: TranslateTextFn;
}): Promise<{
  locales: ProductLocales;
  name: string;
  description: string;
  color?: string;
  i18nSource: Locale;
  failures: TranslationFailure[];
}> {
  const translate = opts.translate || translateText;
  const existingLocales = sanitizeProductLocales(opts.existing?.locales);
  const drafts = sanitizeProductLocales(opts.drafts);
  const sourceLocale = opts.sourceLocale;
  const blocked = wouldOverwriteManual({
    existing: opts.existing,
    sourceLocale,
    fields: opts.fields,
  });
  if (blocked.length && !opts.overwriteManual) {
    throw new ManualTranslationError(blocked);
  }

  const locales: ProductLocales = { ...existingLocales };
  for (const locale of PRODUCT_CONTENT_LOCALES) {
    if (drafts[locale]) {
      locales[locale] = {
        ...emptyProductCopy(),
        ...locales[locale],
        ...drafts[locale],
        origins: {
          ...locales[locale]?.origins,
          ...drafts[locale]?.origins,
        },
      };
    }
  }

  const sourceCopy = copyFromFields(opts.fields, "manual");
  sourceCopy.origins = {
    name: "manual",
    description: "manual",
    ...(trimCopy(opts.fields.color) ? { color: "manual" } : {}),
  };
  locales[sourceLocale] = sourceCopy;

  const i18nSource = opts.existing?.i18nSource || sourceLocale;
  const fromLang: Locale | "auto" = opts.existing && !opts.existing.i18nSource
    ? "auto"
    : sourceLocale;

  type Job = { locale: Locale; field: ProductI18nField; sourceValue: string };
  const jobs: Job[] = [];

  for (const locale of PRODUCT_CONTENT_LOCALES) {
    if (locale === sourceLocale) continue;
    const current = locales[locale] || emptyProductCopy();
    const next: ProductLocaleCopy = {
      ...current,
      origins: { ...current.origins },
    };
    for (const field of PRODUCT_I18N_FIELDS) {
      const sourceValue =
        field === "color" ? trimCopy(opts.fields.color) : trimCopy(opts.fields[field]);
      const origin = fieldOrigin(current, field);
      const isManual = origin === "manual";
      if (isManual && !opts.overwriteManual) continue;
      if (!sourceValue) {
        if (field === "color") {
          next.color = undefined;
          if (next.origins) delete next.origins.color;
        }
        continue;
      }
      const previousSource = existingLocales[sourceLocale]
        ? fieldValue(existingLocales[sourceLocale], field)
        : field === "color"
          ? trimCopy(opts.existing?.color)
          : trimCopy(opts.existing?.[field]);
      const currentValue = fieldValue(current, field);
      const unchanged = Boolean(opts.existing) && sourceValue === previousSource;
      const echoed =
        Boolean(currentValue) && looksUntranslated(currentValue, locale);
      if (unchanged && currentValue && origin && !echoed) continue;
      jobs.push({ locale, field, sourceValue });
    }
    locales[locale] = next;
  }

  const failures: TranslationFailure[] = [];
  const outcomes = await mapPool(jobs, 4, async (job) => {
    try {
      const text = (await translate(job.sourceValue, fromLang, job.locale)).trim();
      if (!text) throw new Error("empty translation");
      return { ...job, ok: true as const, text };
    } catch (error) {
      return {
        ...job,
        ok: false as const,
        error: error instanceof Error ? error.message : "translate failed",
      };
    }
  });

  for (const outcome of outcomes) {
    const next = locales[outcome.locale] || emptyProductCopy();
    next.origins = { ...next.origins };
    if (outcome.ok) {
      if (outcome.field === "color") next.color = outcome.text || undefined;
      else next[outcome.field] = outcome.text;
      next.origins[outcome.field] = "machine";
    } else {
      failures.push({
        locale: outcome.locale,
        path: outcome.field,
        error: outcome.error,
      });
    }
    locales[outcome.locale] = next;
  }

  const keepRoot = Boolean(opts.existing);
  const name = keepRoot
    ? opts.existing!.name
    : sourceCopy.name || opts.fields.name;
  const description = keepRoot
    ? opts.existing!.description
    : sourceCopy.description || opts.fields.description;
  const color = keepRoot ? opts.existing?.color : sourceCopy.color;

  return {
    locales,
    name,
    description,
    color,
    i18nSource,
    failures,
  };
}

export async function fillMissingLocaleCopy(opts: {
  source: ProductLocaleCopy;
  from: Locale | "auto";
  to: Locale;
  translate?: TranslateTextFn;
}): Promise<{ copy: ProductLocaleCopy; failures: TranslationFailure[] }> {
  const translate = opts.translate || translateText;
  const next = emptyProductCopy();
  next.origins = {};
  const failures: TranslationFailure[] = [];
  const fields = PRODUCT_I18N_FIELDS.filter((field) => {
    const value =
      field === "color" ? trimCopy(opts.source.color) : trimCopy(opts.source[field]);
    return Boolean(value);
  });
  const outcomes = await mapPool(fields, 3, async (field) => {
    const value =
      field === "color" ? trimCopy(opts.source.color) : trimCopy(opts.source[field]);
    try {
      const translated = (await translate(value, opts.from, opts.to)).trim();
      if (!translated) throw new Error("empty translation");
      return { field, ok: true as const, text: translated };
    } catch (error) {
      return {
        field,
        ok: false as const,
        error: error instanceof Error ? error.message : "translate failed",
      };
    }
  });
  for (const outcome of outcomes) {
    if (outcome.ok) {
      if (outcome.field === "color") next.color = outcome.text || undefined;
      else next[outcome.field] = outcome.text;
      next.origins![outcome.field] = "machine";
    } else {
      failures.push({
        locale: opts.to,
        path: outcome.field,
        error: outcome.error,
      });
    }
  }
  return { copy: next, failures };
}

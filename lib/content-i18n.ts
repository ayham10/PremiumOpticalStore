import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  emptyCustomPageCopy,
  isCustomPageLocaleComplete,
  sparseCustomPageCopy,
} from "@/lib/custom-service-pages";
import { SERVICE_CONTENT_LOCALES } from "@/lib/service-pages";
import {
  mapPool,
  shouldTranslateField,
  translateText,
  type TranslateTextFn,
  type TranslationFailure,
} from "@/lib/translate-text";
import type {
  CustomPageCopy,
  CustomPageOp,
  CustomPageSection,
  CustomServicePage,
  ServicePageFeature,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

type Path = Array<string | number>;

const COPY_SCALARS: Array<keyof CustomPageCopy> = [
  "eyebrow",
  "title",
  "description",
  "bookingButtonText",
  "benefitsTitle",
  "warningTitle",
  "warningText",
  "valuesTitle",
  "valuesText",
  "privacyText",
  "homeTitle",
  "homeSubtitle",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pathKey(path: Path): string {
  return path.join(".");
}

function getPath(obj: unknown, path: Path): string {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null) return "";
    if (typeof key === "number") {
      cur = Array.isArray(cur) ? cur[key] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }
  return typeof cur === "string" ? cur : "";
}

function setPath(obj: Record<string, unknown>, path: Path, value: string): void {
  let cur: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const nextKey = path[i + 1];
    const nextIsIndex = typeof nextKey === "number";
    if (typeof key === "number") {
      const list = Array.isArray(cur) ? cur : [];
      if (list[key] == null || typeof list[key] !== "object") {
        list[key] = nextIsIndex ? [] : {};
      }
      cur = list[key] as Record<string, unknown> | unknown[];
    } else {
      const rec = cur as Record<string, unknown>;
      if (rec[key] == null || typeof rec[key] !== "object") {
        rec[key] = nextIsIndex ? [] : {};
      }
      cur = rec[key] as Record<string, unknown> | unknown[];
    }
  }
  const last = path[path.length - 1];
  if (typeof last === "number") {
    (cur as unknown[])[last] = value;
  } else {
    (cur as Record<string, unknown>)[last] = value;
  }
}

function collectBundlePaths(bundle: ServicePagesLocaleBundle): Path[] {
  const paths: Path[] = [];
  const eye = bundle.eyeExam;
  if (eye) {
    for (const key of [
      "eyebrow",
      "title",
      "description",
      "bookingButtonText",
      "benefitsTitle",
    ] as const) {
      paths.push(["eyeExam", key]);
    }
    (eye.features || []).forEach((_feature, index) => {
      paths.push(["eyeExam", "features", index, "title"]);
      paths.push(["eyeExam", "features", index, "description"]);
    });
    (eye.benefits || []).forEach((_item, index) => {
      paths.push(["eyeExam", "benefits", index]);
    });
  }
  const lenses = bundle.contactLenses;
  if (lenses) {
    for (const key of [
      "eyebrow",
      "title",
      "description",
      "bookingButtonText",
      "warningTitle",
      "warningText",
    ] as const) {
      paths.push(["contactLenses", key]);
    }
    (lenses.features || []).forEach((_feature, index) => {
      paths.push(["contactLenses", "features", index, "title"]);
      paths.push(["contactLenses", "features", index, "description"]);
    });
  }
  if (bundle.homepage?.hero) {
    const hero = bundle.homepage.hero;
    for (const key of [
      "title",
      "subtitle",
      "bookingButtonText",
      "shopButtonText",
    ] as const) {
      paths.push(["homepage", "hero", key]);
    }
    (hero.serviceLabels || []).forEach((_label, index) => {
      paths.push(["homepage", "hero", "serviceLabels", index]);
    });
  }
  if (bundle.footer) {
    for (const key of [
      "tagline",
      "hoursLabel",
      "locationLabel",
      "address",
    ] as const) {
      paths.push(["footer", key]);
    }
  }
  for (const page of ["catalog", "sunglasses", "frames"] as const) {
    if (!bundle[page]) continue;
    paths.push([page, "title"]);
    paths.push([page, "lead"]);
  }
  return paths;
}

type TranslateJob = {
  locale: Locale;
  path: Path;
  sourceValue: string;
};

async function runJobs(
  jobs: TranslateJob[],
  from: Locale,
  translate: TranslateTextFn,
): Promise<{
  done: Array<TranslateJob & { text: string }>;
  failures: TranslationFailure[];
}> {
  const outcomes = await mapPool(jobs, 4, async (job) => {
    try {
      const text = (await translate(job.sourceValue, from, job.locale)).trim();
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
  const done: Array<TranslateJob & { text: string }> = [];
  const failures: TranslationFailure[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) {
      done.push({
        locale: outcome.locale,
        path: outcome.path,
        sourceValue: outcome.sourceValue,
        text: outcome.text,
      });
    } else {
      failures.push({
        locale: outcome.locale,
        path: pathKey(outcome.path),
        error: outcome.error,
      });
    }
  }
  return { done, failures };
}

function originOf(
  origins: Record<string, "machine" | "manual"> | undefined,
  path: Path,
): "machine" | "manual" | undefined {
  const value = origins?.[pathKey(path)];
  return value === "machine" || value === "manual" ? value : undefined;
}

function stampOrigin(
  origins: Record<string, "machine" | "manual"> | undefined,
  path: Path,
  origin: "machine" | "manual",
): Record<string, "machine" | "manual"> {
  return { ...(origins || {}), [pathKey(path)]: origin };
}

function collectCopyJobs(
  source: CustomPageCopy,
  previous: CustomPageCopy | undefined,
  target: CustomPageCopy | undefined,
  locale: Locale,
  fillMissing: boolean,
): TranslateJob[] {
  const jobs: TranslateJob[] = [];
  for (const key of COPY_SCALARS) {
    const src = trim(source[key]);
    const path: Path = [key];
    if (
      !shouldTranslateField({
        source: src,
        previous: trim(previous?.[key]),
        target: trim(target?.[key]),
        targetLocale: locale,
        fillMissing,
        targetOrigin: originOf(target?.origins, path),
      })
    ) {
      continue;
    }
    jobs.push({ locale, path, sourceValue: src });
  }
  const features = Array.isArray(source.features) ? source.features : [];
  features.forEach((feature, index) => {
    for (const key of ["title", "description"] as const) {
      const src = trim(feature?.[key]);
      const path: Path = ["features", index, key];
      if (
        !shouldTranslateField({
          source: src,
          previous: trim(previous?.features?.[index]?.[key]),
          target: trim(target?.features?.[index]?.[key]),
          targetLocale: locale,
          fillMissing,
          targetOrigin: originOf(target?.origins, path),
        })
      ) {
        continue;
      }
      jobs.push({ locale, path, sourceValue: src });
    }
  });
  const benefits = Array.isArray(source.benefits) ? source.benefits : [];
  benefits.forEach((item, index) => {
    const src = trim(item);
    const path: Path = ["benefits", index];
    if (
      !shouldTranslateField({
        source: src,
        previous: trim(previous?.benefits?.[index]),
        target: trim(target?.benefits?.[index]),
        targetLocale: locale,
        fillMissing,
        targetOrigin: originOf(target?.origins, path),
      })
    ) {
      return;
    }
    jobs.push({ locale, path, sourceValue: src });
  });
  return jobs;
}

function seedTargetCopy(
  source: CustomPageCopy,
  existing: CustomPageCopy | undefined,
): CustomPageCopy {
  if (existing) return structuredClone(existing);
  const next = emptyCustomPageCopy();
  next.features = (source.features || next.features).map(
    (feature: ServicePageFeature, index) => ({
      title: "",
      description: "",
      icon: feature.icon || next.features[index]?.icon,
    }),
  );
  return next;
}

async function translateCustomPageCopy(opts: {
  source: CustomPageCopy;
  previous?: CustomPageCopy;
  existing?: CustomServicePage["locales"];
  sourceLocale: ServicePagesLocale;
  sections: CustomPageSection[];
  showHeroButton: boolean;
  translate: TranslateTextFn;
}): Promise<{
  locales: Partial<Record<ServicePagesLocale, CustomPageCopy>>;
  failures: TranslationFailure[];
}> {
  const jobs: TranslateJob[] = [];
  const bases: Partial<Record<ServicePagesLocale, CustomPageCopy>> = {};
  for (const locale of SERVICE_CONTENT_LOCALES) {
    if (locale === opts.sourceLocale) continue;
    const existing = opts.existing?.[locale];
    bases[locale] = seedTargetCopy(opts.source, existing);
    jobs.push(
      ...collectCopyJobs(
        opts.source,
        opts.previous,
        existing,
        locale,
        true,
      ),
    );
  }
  const { done, failures } = await runJobs(
    jobs,
    opts.sourceLocale,
    opts.translate,
  );
  for (const item of done) {
    const base = bases[item.locale as ServicePagesLocale];
    if (!base) continue;
    setPath(base as unknown as Record<string, unknown>, item.path, item.text);
    base.origins = stampOrigin(base.origins, item.path, "machine");
  }
  const locales: Partial<Record<ServicePagesLocale, CustomPageCopy>> = {};
  for (const locale of SERVICE_CONTENT_LOCALES) {
    if (locale === opts.sourceLocale) continue;
    const copy = bases[locale];
    if (!copy) continue;
    copy.complete = isCustomPageLocaleComplete(
      opts.sections,
      copy,
      opts.showHeroButton,
    );
    locales[locale] = sparseCustomPageCopy(copy);
    locales[locale]!.complete = copy.complete;
  }
  return { locales, failures };
}

async function translateSectionArticles(opts: {
  sections: CustomPageSection[];
  storedSections?: CustomPageSection[];
  sourceLocale: ServicePagesLocale;
  translate: TranslateTextFn;
}): Promise<{ sections: CustomPageSection[]; failures: TranslationFailure[] }> {
  const sections = structuredClone(opts.sections);
  const storedById = new Map(
    (opts.storedSections || []).map((section) => [section.id, section]),
  );
  const jobs: TranslateJob[] = [];
  sections.forEach((section, sectionIndex) => {
    const article = section.article;
    if (!article?.locales) return;
    const source = article.locales[opts.sourceLocale];
    if (!source) return;
    const previousCopy =
      storedById.get(section.id)?.article?.locales?.[opts.sourceLocale];
    for (const locale of SERVICE_CONTENT_LOCALES) {
      if (locale === opts.sourceLocale) continue;
      const target = article.locales[locale];
      for (const field of ["heading", "body"] as const) {
        const src = trim(source[field]);
        if (
          !shouldTranslateField({
            source: src,
            previous: trim(previousCopy?.[field]),
            target: trim(target?.[field]),
            targetLocale: locale,
            fillMissing: true,
          })
        ) {
          continue;
        }
        jobs.push({
          locale,
          path: [sectionIndex, field],
          sourceValue: src,
        });
      }
    }
  });
  const { done, failures } = await runJobs(
    jobs,
    opts.sourceLocale,
    opts.translate,
  );
  for (const item of done) {
    const sectionIndex = item.path[0];
    const field = item.path[1];
    if (typeof sectionIndex !== "number" || typeof field !== "string") continue;
    const article = sections[sectionIndex]?.article;
    if (!article) continue;
    const locales = { ...(article.locales || {}) };
    const current = locales[item.locale as ServicePagesLocale] || {
      heading: "",
      body: "",
    };
    locales[item.locale as ServicePagesLocale] = {
      ...current,
      [field]: item.text,
    };
    article.locales = locales;
  }
  const mappedFailures = failures.map((failure) => ({
    ...failure,
    path: `article.${failure.path}`,
  }));
  return { sections, failures: mappedFailures };
}

async function translateLocaleBundles(opts: {
  stored?: ServicePagesSettings;
  patchLocales: Record<string, unknown>;
  translate: TranslateTextFn;
}): Promise<{
  locales: Record<string, unknown>;
  failures: TranslationFailure[];
}> {
  const sourceLocales = SERVICE_CONTENT_LOCALES.filter(
    (locale) => locale in opts.patchLocales,
  );
  if (sourceLocales.length !== 1) {
    return { locales: opts.patchLocales, failures: [] };
  }
  const sourceLocale = sourceLocales[0];
  const sourceBundle = opts.patchLocales[sourceLocale];
  if (!sourceBundle || typeof sourceBundle !== "object") {
    return { locales: opts.patchLocales, failures: [] };
  }
  const prevBundle = opts.stored?.locales?.[sourceLocale];
  const paths = collectBundlePaths(sourceBundle as ServicePagesLocaleBundle);
  const jobs: TranslateJob[] = [];
  const bases: Partial<Record<ServicePagesLocale, Record<string, unknown>>> = {};
  const sourceRecord = sourceBundle as ServicePagesLocaleBundle & {
    i18nOrigins?: Record<string, "machine" | "manual">;
  };
  let sourceOrigins = { ...(sourceRecord.i18nOrigins || {}) };
  for (const path of paths) {
    if (getPath(sourceBundle, path)) {
      sourceOrigins = stampOrigin(sourceOrigins, path, "manual");
    }
  }
  sourceRecord.i18nOrigins = sourceOrigins;

  for (const locale of SERVICE_CONTENT_LOCALES) {
    if (locale === sourceLocale) continue;
    const existing = opts.stored?.locales?.[locale];
    bases[locale] = existing
      ? (structuredClone(existing) as unknown as Record<string, unknown>)
      : {};
    const existingOrigins = existing?.i18nOrigins;
    for (const path of paths) {
      const sourceValue = getPath(sourceBundle, path);
      if (
        !shouldTranslateField({
          source: sourceValue,
          previous: getPath(prevBundle, path),
          target: getPath(existing, path),
          targetLocale: locale,
          fillMissing: false,
          targetOrigin: originOf(existingOrigins, path),
        })
      ) {
        continue;
      }
      jobs.push({ locale, path, sourceValue });
    }
  }

  const { done, failures } = await runJobs(
    jobs,
    sourceLocale,
    opts.translate,
  );
  const locales: Record<string, unknown> = { ...opts.patchLocales, [sourceLocale]: sourceRecord };
  const touched = new Set<ServicePagesLocale>();
  for (const item of done) {
    const locale = item.locale as ServicePagesLocale;
    const base = bases[locale];
    if (!base) continue;
    setPath(base, item.path, item.text);
    const currentOrigins = asRecord(base.i18nOrigins) as Record<
      string,
      "machine" | "manual"
    >;
    base.i18nOrigins = stampOrigin(currentOrigins, item.path, "machine");
    touched.add(locale);
  }
  for (const locale of touched) {
    locales[locale] = bases[locale];
  }
  return { locales, failures };
}

/**
 * Expand a service-pages save patch so sibling languages are generated and
 * persisted in the same request. Does not invent copy when persist is used
 * without this helper (tests for one-locale patches stay unchanged).
 */
export async function expandServicePagesTranslations(opts: {
  stored?: ServicePagesSettings;
  patch: unknown;
  translate?: TranslateTextFn;
}): Promise<{ patch: unknown; failures: TranslationFailure[] }> {
  if (!opts.patch || typeof opts.patch !== "object") {
    return { patch: opts.patch, failures: [] };
  }
  const translate = opts.translate || translateText;
  const nextPatch = structuredClone(opts.patch) as Record<string, unknown>;
  const failures: TranslationFailure[] = [];

  const patchLocales = asRecord(nextPatch.locales);
  if (SERVICE_CONTENT_LOCALES.some((locale) => locale in patchLocales)) {
    const expanded = await translateLocaleBundles({
      stored: opts.stored,
      patchLocales,
      translate,
    });
    nextPatch.locales = expanded.locales;
    failures.push(...expanded.failures);
  }

  const op = nextPatch.customPageOp as CustomPageOp | undefined;
  if (op && op.op === "update" && op.locale && op.copy && isLocale(op.locale)) {
    const page = (opts.stored?.customPages || []).find((item) => item.id === op.id);
    const sections = op.sections || page?.sections || [];
    const showHeroButton =
      op.showHeroButton != null
        ? Boolean(op.showHeroButton)
        : Boolean(page?.showHeroButton);
    const previous = page?.locales?.[op.locale];
    const sourceCopy = structuredClone(op.copy);
    let sourceOrigins = { ...(sourceCopy.origins || {}) };
    for (const job of collectCopyJobs(sourceCopy, undefined, undefined, "en", true)) {
      sourceOrigins = stampOrigin(sourceOrigins, job.path, "manual");
    }
    sourceCopy.origins = sourceOrigins;
    op.copy = sourceCopy;
    const copies = await translateCustomPageCopy({
      source: sourceCopy,
      previous,
      existing: page?.locales,
      sourceLocale: op.locale,
      sections,
      showHeroButton,
      translate,
    });
    failures.push(...copies.failures);
    if (Object.keys(copies.locales).length) {
      (op as Extract<CustomPageOp, { op: "update" }>).locales = copies.locales;
    }
    if (op.sections?.length) {
      const articles = await translateSectionArticles({
        sections: op.sections,
        storedSections: page?.sections,
        sourceLocale: op.locale,
        translate,
      });
      op.sections = articles.sections;
      failures.push(...articles.failures);
    }
    nextPatch.customPageOp = op;
  }

  return { patch: nextPatch, failures };
}

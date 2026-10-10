import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  pickServiceFeatureIcon,
  type ServiceFeatureIconId,
} from "@/lib/service-page-icons";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  normalizeCustomPages,
  persistCustomPages,
} from "@/lib/custom-service-pages";
import {
  parseCustomPageMedia,
} from "@/lib/custom-service-pages";
import type {
  CatalogServicePage,
  ContactLensesServicePage,
  CustomPageMediaRef,
  EyeExamServicePage,
  FooterServiceContent,
  HomepageHeroContent,
  HomepageServicePage,
  ServicePageFeature,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

export const SERVICE_CONTENT_LOCALES: readonly ServicePagesLocale[] = [
  "ar",
  "he",
  "en",
];

export const SERVICE_LABEL_COUNT = 3;
export const EYE_EXAM_FEATURE_COUNT = 4;
export const CONTACT_LENSES_FEATURE_COUNT = 4;
export const EYE_EXAM_BENEFIT_COUNT = 5;

/** Current production Arabic copy — used as Admin defaults / Restore Original. */
export const DEFAULT_SERVICE_PAGES: ServicePagesSettings = {
  eyeExam: {
    eyebrow: "رعاية احترافية",
    title: "فحص نظر شامل",
    description:
      "فحص دقيق بأحدث الأجهزة مع أخصائيين معتمدين لضمان رؤية أوضح وحياة أفضل.",
    bookingButtonText: "احجز فحص نظر",
    features: [
      { title: "أخصائيون معتمدون", description: "خبرة موثوقة", icon: "user-round" },
      { title: "20 - 30 دقيقة فقط", description: "حجز سريع وسهل", icon: "clock-3" },
      { title: "أجهزة حديثة ودقيقة", description: "نتائج دقيقة", icon: "shield-check" },
      {
        title: "فحص شامل لجميع جوانب الرؤية",
        description: "حدة النظر وصحة العين",
        icon: "eye",
      },
    ],
    benefitsTitle: "ما يميز فحص النظر لدينا",
    benefits: [
      "قياس دقة البصر لكل عين على حدة.",
      "فحص ضغط العين للكشف المبكر عن الجلوكوما.",
      "تقييم صحة الشبكية والعصب البصري.",
      "فحص التناسق بين العينين وحركة العضلات.",
      "تحديد الحاجة للنظارات أو العدسات الطبية المناسبة.",
    ],
  },
  contactLenses: {
    eyebrow: "رعاية احترافية",
    title: "العدسات اللاصقة",
    description:
      "اختر عدسات لاصقة مريحة تناسب نظرك ونمط حياتك واستخدامك اليومي.",
    bookingButtonText: "احجز فحص ملاءمة للعدسات",
    features: [
      {
        title: "ملاءمة احترافية",
        description: "قياسات دقيقة واختيار العدسة المناسبة لعينيك.",
        icon: "ruler",
      },
      {
        title: "عدسات يومية أو شهرية",
        description: "اختر مدة الاستخدام التي تناسب نمط حياتك.",
        icon: "droplets",
      },
      {
        title: "متابعة وإرشاد",
        description: "نصائح حول الراحة والعناية والاستخدام الآمن.",
        icon: "heart-handshake",
      },
      {
        title: "سلامة عينيك أولاً",
        description: "ملاءمة مهنية واستخدام يومي حذر.",
        icon: "shield-check",
      },
    ],
    warningText:
      "يجب اختيار العدسات اللاصقة بملاءمة مهنية. لا تستخدم العدسات لمدة أطول من الموصى بها، وأوقف استخدامها عند الشعور بألم أو احمرار أو انزعاج غير طبيعي.",
  },
  catalog: {
    title: "المتجر",
    lead: "اكتشف مجموعتنا الفاخرة",
  },
  sunglasses: {
    title: "نظارات شمسية",
    lead: "اكتشف نظارات شمسية فاخرة تجمع بين الحماية والراحة والأناقة.",
  },
  frames: {
    title: "إطارات فاخرة",
    lead: "تصاميم مختارة من الأسيتات والتيتانيوم والمعدن — بتفصيل هادئ ودقيق.",
  },
  homepage: {
    hero: {
      title: "عِش الحياة بوضوح",
      subtitle: "إطارات طبية • نظارات شمسية • فحص نظر احترافي",
      serviceLabels: ["إطارات طبية", "نظارات شمسية", "فحص نظر احترافي"],
      bookingButtonText: "احجز موعدًا",
      shopButtonText: "تسوق الآن",
    },
  },
  footer: {
    tagline: "رؤية أدق. أسلوب أنقى. تجربة فاخرة.",
    hoursLabel: "ساعات العمل",
    locationLabel: "الموقع",
    address: "دير حنا",
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function isServicePagesLocale(
  value: string | null | undefined,
): value is ServicePagesLocale {
  return value === "ar" || value === "he" || value === "en";
}

function defaultFeatureIcon(
  index: number,
  fallbacks: readonly ServiceFeatureIconId[],
): ServiceFeatureIconId {
  return fallbacks[index] ?? fallbacks[0] ?? "eye";
}

function sparseFeature(
  saved: unknown,
  index: number,
  icons: readonly ServiceFeatureIconId[],
  iconFallback?: string,
): ServicePageFeature {
  const row = asRecord(saved);
  return {
    title: cleanText(row.title),
    description: cleanText(row.description),
    icon: pickServiceFeatureIcon(
      cleanText(row.icon) || iconFallback || undefined,
      defaultFeatureIcon(index, icons),
    ),
  };
}

function sparseFeatureList(
  saved: unknown,
  count: number,
  icons: readonly ServiceFeatureIconId[],
  iconFallbacks?: Array<string | undefined>,
): ServicePageFeature[] {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: count }, (_, index) =>
    sparseFeature(list[index], index, icons, iconFallbacks?.[index]),
  );
}

function sparseStringList(saved: unknown, count: number): string[] {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: count }, (_, index) => cleanText(list[index]));
}

function sparseEyeExam(
  saved: unknown,
  iconFallbacks?: Array<string | undefined>,
): EyeExamServicePage {
  const raw = asRecord(saved);
  return {
    eyebrow: cleanText(raw.eyebrow),
    title: cleanText(raw.title),
    description: cleanText(raw.description),
    bookingButtonText: cleanText(raw.bookingButtonText),
    features: sparseFeatureList(
      raw.features,
      EYE_EXAM_FEATURE_COUNT,
      EYE_EXAM_DEFAULT_FEATURE_ICONS,
      iconFallbacks,
    ),
    benefitsTitle: cleanText(raw.benefitsTitle),
    benefits: sparseStringList(raw.benefits, EYE_EXAM_BENEFIT_COUNT),
    heroMedia: persistHeroMedia(raw, "heroMedia", undefined),
  };
}

function sparseContactLenses(
  saved: unknown,
  iconFallbacks?: Array<string | undefined>,
): ContactLensesServicePage {
  const raw = asRecord(saved);
  return {
    eyebrow: cleanText(raw.eyebrow),
    title: cleanText(raw.title),
    description: cleanText(raw.description),
    bookingButtonText: cleanText(raw.bookingButtonText),
    features: sparseFeatureList(
      raw.features,
      CONTACT_LENSES_FEATURE_COUNT,
      CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
      iconFallbacks,
    ),
    warningTitle: cleanText(raw.warningTitle),
    warningText: cleanText(raw.warningText),
    heroMedia: persistHeroMedia(raw, "heroMedia", undefined),
  };
}

function persistHeroMedia(
  raw: Record<string, unknown>,
  key: string,
  fallback?: CustomPageMediaRef,
): CustomPageMediaRef | undefined {
  if (!(key in raw)) return fallback;
  if (raw[key] == null) return undefined;
  return parseCustomPageMedia(raw[key]);
}

function sparseCatalog(saved: unknown): CatalogServicePage {
  const raw = asRecord(saved);
  const next: CatalogServicePage = {
    title: cleanText(raw.title),
    lead: cleanText(raw.lead),
  };
  const heroMedia = persistHeroMedia(raw, "heroMedia", undefined);
  if (heroMedia) next.heroMedia = heroMedia;
  return next;
}

type OptionalCatalogKey = "catalog" | "sunglasses" | "frames";

function hasOptionalPageSettings(
  value: unknown,
  key: OptionalCatalogKey,
  locale?: ServicePagesLocale,
): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as {
    [page in OptionalCatalogKey]?: unknown;
    locales?: Partial<Record<ServicePagesLocale, Record<string, unknown>>>;
  };
  if (locale) {
    const localized = raw.locales?.[locale]?.[key];
    if (localized && typeof localized === "object") return true;
    if (locale === "ar" && raw[key] && typeof raw[key] === "object") {
      return true;
    }
    return false;
  }
  if (raw[key] && typeof raw[key] === "object") return true;
  const locales = raw.locales;
  if (!locales) return false;
  return SERVICE_CONTENT_LOCALES.some((item) => {
    const page = locales[item]?.[key];
    return Boolean(page && typeof page === "object");
  });
}

function sparseAdminSectionNames(
  saved: unknown,
): Record<string, string> | undefined {
  const raw = asRecord(saved);
  const names: Record<string, string> = {};
  for (const [id, label] of Object.entries(raw)) {
    if (!id.trim()) continue;
    const value = cleanText(label).trim();
    if (value) names[id] = value;
  }
  return Object.keys(names).length ? names : undefined;
}

function sparseHomepageHero(saved: unknown): HomepageHeroContent {
  const raw = asRecord(saved);
  const labels = Array.isArray(raw.serviceLabels) ? raw.serviceLabels : [];
  return {
    title: cleanText(raw.title),
    subtitle: cleanText(raw.subtitle),
    serviceLabels: Array.from({ length: SERVICE_LABEL_COUNT }, (_, index) =>
      cleanText(labels[index]),
    ),
    bookingButtonText: cleanText(raw.bookingButtonText),
    shopButtonText: cleanText(raw.shopButtonText),
  };
}

function sparseHomepage(saved: unknown): HomepageServicePage {
  const raw = asRecord(saved);
  return { hero: sparseHomepageHero(raw.hero) };
}

function sparseFooter(saved: unknown): FooterServiceContent {
  const raw = asRecord(saved);
  return {
    tagline: cleanText(raw.tagline),
    hoursLabel: cleanText(raw.hoursLabel),
    locationLabel: cleanText(raw.locationLabel),
    address: cleanText(raw.address),
  };
}

function featureIconsOf(features: ServicePageFeature[] | undefined): string[] {
  return (features || []).map((feature) => feature.icon || "");
}

function sparseBundle(
  saved: unknown,
  iconSource?: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  const raw = asRecord(saved);
  const bundle: ServicePagesLocaleBundle = {
    eyeExam: sparseEyeExam(
      raw.eyeExam,
      featureIconsOf(iconSource?.eyeExam.features),
    ),
    contactLenses: sparseContactLenses(
      raw.contactLenses,
      featureIconsOf(iconSource?.contactLenses.features),
    ),
  };
  if (hasHomepageSettings(saved)) {
    bundle.homepage = sparseHomepage(raw.homepage);
  }
  if (hasFooterSettings(saved)) {
    bundle.footer = sparseFooter(raw.footer);
  }
  if (hasCatalogSettings(saved)) {
    bundle.catalog = sparseCatalog(raw.catalog);
  }
  if (hasSunglassesSettings(saved)) {
    bundle.sunglasses = sparseCatalog(raw.sunglasses);
  }
  if (hasFramesSettings(saved)) {
    bundle.frames = sparseCatalog(raw.frames);
  }
  const adminSectionNames = sparseAdminSectionNames(raw.adminSectionNames);
  if (adminSectionNames) bundle.adminSectionNames = adminSectionNames;
  return bundle;
}

function hasAnyRootContent(value: unknown): boolean {
  const raw = asRecord(value);
  return Boolean(
    raw.eyeExam ||
      raw.contactLenses ||
      raw.homepage ||
      raw.footer ||
      raw.catalog ||
      raw.sunglasses ||
      raw.frames,
  );
}

export function hasHomepageSettings(
  value: unknown,
  locale?: ServicePagesLocale,
): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as {
    homepage?: unknown;
    locales?: Partial<Record<ServicePagesLocale, { homepage?: unknown }>>;
  };
  if (locale) {
    const localized = raw.locales?.[locale]?.homepage;
    if (localized && typeof localized === "object") return true;
    if (locale === "ar" && raw.homepage && typeof raw.homepage === "object") {
      return true;
    }
    return false;
  }
  if (raw.homepage && typeof raw.homepage === "object") return true;
  const locales = raw.locales;
  if (!locales) return false;
  return SERVICE_CONTENT_LOCALES.some((key) => {
    const homepage = locales[key]?.homepage;
    return Boolean(homepage && typeof homepage === "object");
  });
}

export function hasCatalogSettings(
  value: unknown,
  locale?: ServicePagesLocale,
): boolean {
  return hasOptionalPageSettings(value, "catalog", locale);
}

export function hasSunglassesSettings(
  value: unknown,
  locale?: ServicePagesLocale,
): boolean {
  return hasOptionalPageSettings(value, "sunglasses", locale);
}

export function hasFramesSettings(
  value: unknown,
  locale?: ServicePagesLocale,
): boolean {
  return hasOptionalPageSettings(value, "frames", locale);
}

export function hasFooterSettings(
  value: unknown,
  locale?: ServicePagesLocale,
): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as {
    footer?: unknown;
    locales?: Partial<Record<ServicePagesLocale, { footer?: unknown }>>;
  };
  if (locale) {
    const localized = raw.locales?.[locale]?.footer;
    if (localized && typeof localized === "object") return true;
    if (locale === "ar" && raw.footer && typeof raw.footer === "object") {
      return true;
    }
    return false;
  }
  if (raw.footer && typeof raw.footer === "object") return true;
  const locales = raw.locales;
  if (!locales) return false;
  return SERVICE_CONTENT_LOCALES.some((key) => {
    const footer = locales[key]?.footer;
    return Boolean(footer && typeof footer === "object");
  });
}

function overlayText(saved: string | undefined, fallback: string): string {
  const value = saved?.trim();
  return value || fallback;
}

function overlayFeature(
  saved: ServicePageFeature | undefined,
  fallback: ServicePageFeature,
): ServicePageFeature {
  return {
    title: overlayText(saved?.title, fallback.title),
    description: overlayText(saved?.description, fallback.description),
    icon: pickServiceFeatureIcon(
      saved?.icon || fallback.icon,
      (fallback.icon || "eye") as ServiceFeatureIconId,
    ),
  };
}

function overlayFeatureList(
  saved: ServicePageFeature[] | undefined,
  fallbacks: ServicePageFeature[],
): ServicePageFeature[] {
  return fallbacks.map((fallback, index) =>
    overlayFeature(saved?.[index], fallback),
  );
}

function overlayStringList(
  saved: string[] | undefined,
  fallbacks: string[],
): string[] {
  return fallbacks.map((fallback, index) =>
    overlayText(saved?.[index], fallback),
  );
}

function overlayEyeExam(
  saved: EyeExamServicePage | undefined,
  fallback: EyeExamServicePage,
): EyeExamServicePage {
  return {
    eyebrow: overlayText(saved?.eyebrow, fallback.eyebrow),
    title: overlayText(saved?.title, fallback.title),
    description: overlayText(saved?.description, fallback.description),
    bookingButtonText: overlayText(
      saved?.bookingButtonText,
      fallback.bookingButtonText,
    ),
    features: overlayFeatureList(saved?.features, fallback.features),
    benefitsTitle: overlayText(saved?.benefitsTitle, fallback.benefitsTitle),
    benefits: overlayStringList(saved?.benefits, fallback.benefits),
    heroMedia: saved?.heroMedia || fallback.heroMedia,
  };
}

function overlayContactLenses(
  saved: ContactLensesServicePage | undefined,
  fallback: ContactLensesServicePage,
): ContactLensesServicePage {
  return {
    eyebrow: overlayText(saved?.eyebrow, fallback.eyebrow),
    title: overlayText(saved?.title, fallback.title),
    description: overlayText(saved?.description, fallback.description),
    bookingButtonText: overlayText(
      saved?.bookingButtonText,
      fallback.bookingButtonText,
    ),
    features: overlayFeatureList(saved?.features, fallback.features),
    warningTitle: overlayText(saved?.warningTitle, fallback.warningTitle || ""),
    warningText: overlayText(saved?.warningText, fallback.warningText),
    heroMedia: saved?.heroMedia || fallback.heroMedia,
  };
}

function overlayCatalog(
  saved: CatalogServicePage | undefined,
  fallback: CatalogServicePage,
): CatalogServicePage {
  const next: CatalogServicePage = {
    title: overlayText(saved?.title, fallback.title || ""),
    lead: overlayText(saved?.lead, fallback.lead || ""),
  };
  const heroMedia = saved?.heroMedia || fallback.heroMedia;
  if (heroMedia) next.heroMedia = heroMedia;
  return next;
}

function overlayHomepageHero(
  saved: HomepageHeroContent | undefined,
  fallback: HomepageHeroContent,
): HomepageHeroContent {
  return {
    title: overlayText(saved?.title, fallback.title),
    subtitle: overlayText(saved?.subtitle, fallback.subtitle || ""),
    serviceLabels: overlayStringList(
      saved?.serviceLabels,
      fallback.serviceLabels,
    ),
    bookingButtonText: overlayText(
      saved?.bookingButtonText,
      fallback.bookingButtonText,
    ),
    shopButtonText: overlayText(saved?.shopButtonText, fallback.shopButtonText),
  };
}

function overlayHomepage(
  saved: HomepageServicePage | undefined,
  fallback: HomepageServicePage,
): HomepageServicePage {
  return { hero: overlayHomepageHero(saved?.hero, fallback.hero) };
}

function overlayFooter(
  saved: FooterServiceContent | undefined,
  fallback: FooterServiceContent,
): FooterServiceContent {
  return {
    tagline: overlayText(saved?.tagline, fallback.tagline),
    hoursLabel: overlayText(saved?.hoursLabel, fallback.hoursLabel),
    locationLabel: overlayText(saved?.locationLabel, fallback.locationLabel),
    address: overlayText(saved?.address, fallback.address),
  };
}

function overlayBundle(
  saved: ServicePagesLocaleBundle | undefined,
  fallback: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  const next: ServicePagesLocaleBundle = {
    eyeExam: overlayEyeExam(saved?.eyeExam, fallback.eyeExam),
    contactLenses: overlayContactLenses(
      saved?.contactLenses,
      fallback.contactLenses,
    ),
    footer: overlayFooter(saved?.footer, fallback.footer ?? {
      tagline: "",
      hoursLabel: "",
      locationLabel: "",
      address: "",
    }),
  };
  if (fallback.homepage || saved?.homepage) {
    next.homepage = overlayHomepage(
      saved?.homepage,
      fallback.homepage ?? {
        hero: {
          title: "",
          subtitle: "",
          serviceLabels: ["", "", ""],
          bookingButtonText: "",
          shopButtonText: "",
        },
      },
    );
  }
  if (fallback.catalog || saved?.catalog) {
    next.catalog = overlayCatalog(saved?.catalog, fallback.catalog ?? {});
  }
  if (fallback.sunglasses || saved?.sunglasses) {
    next.sunglasses = overlayCatalog(
      saved?.sunglasses,
      fallback.sunglasses ?? {},
    );
  }
  if (fallback.frames || saved?.frames) {
    next.frames = overlayCatalog(saved?.frames, fallback.frames ?? {});
  }
  if (saved?.adminSectionNames) {
    next.adminSectionNames = saved.adminSectionNames;
  }
  return next;
}

function persistBundle(
  stored: unknown,
  patch: unknown,
  iconSource?: ServicePagesLocaleBundle,
  options?: { includeHomepage?: boolean; includeFooter?: boolean },
): ServicePagesLocaleBundle {
  const storedRaw = asRecord(stored);
  const patchRaw = asRecord(patch);
  const includeHomepage =
    options?.includeHomepage ||
    hasHomepageSettings(stored) ||
    hasHomepageSettings(patch);
  const includeFooter =
    options?.includeFooter ||
    hasFooterSettings(stored) ||
    hasFooterSettings(patch);
  const includeCatalog =
    hasCatalogSettings(stored) || hasCatalogSettings(patch);
  const includeSunglasses =
    hasSunglassesSettings(stored) || hasSunglassesSettings(patch);
  const includeFrames =
    hasFramesSettings(stored) || hasFramesSettings(patch);

  const next: ServicePagesLocaleBundle = {
    eyeExam: sparseEyeExam(
      { ...asRecord(storedRaw.eyeExam), ...asRecord(patchRaw.eyeExam) },
      featureIconsOf(iconSource?.eyeExam.features),
    ),
    contactLenses: sparseContactLenses(
      {
        ...asRecord(storedRaw.contactLenses),
        ...asRecord(patchRaw.contactLenses),
      },
      featureIconsOf(iconSource?.contactLenses.features),
    ),
  };

  if (includeHomepage) {
    const storedHome = asRecord(storedRaw.homepage);
    const patchHome = asRecord(patchRaw.homepage);
    next.homepage = sparseHomepage({
      ...storedHome,
      ...patchHome,
      hero: {
        ...asRecord(storedHome.hero),
        ...asRecord(patchHome.hero),
      },
    });
  } else if (hasHomepageSettings(stored)) {
    next.homepage = sparseHomepage(storedRaw.homepage);
  }

  if (includeFooter) {
    next.footer = sparseFooter({
      ...asRecord(storedRaw.footer),
      ...asRecord(patchRaw.footer),
    });
  } else if (hasFooterSettings(stored)) {
    next.footer = sparseFooter(storedRaw.footer);
  }

  if (includeCatalog) {
    next.catalog = sparseCatalog({
      ...asRecord(storedRaw.catalog),
      ...asRecord(patchRaw.catalog),
    });
  }

  if (includeSunglasses) {
    next.sunglasses = sparseCatalog({
      ...asRecord(storedRaw.sunglasses),
      ...asRecord(patchRaw.sunglasses),
    });
  }

  if (includeFrames) {
    next.frames = sparseCatalog({
      ...asRecord(storedRaw.frames),
      ...asRecord(patchRaw.frames),
    });
  }

  const adminSectionNames = sparseAdminSectionNames({
    ...asRecord(storedRaw.adminSectionNames),
    ...asRecord(patchRaw.adminSectionNames),
  });
  if (adminSectionNames) next.adminSectionNames = adminSectionNames;

  return next;
}

function emptyBundle(): ServicePagesLocaleBundle {
  return {
    eyeExam: sparseEyeExam({}),
    contactLenses: sparseContactLenses({}),
  };
}

function syncLegacyRoot(
  locales: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>>,
  fallbackRoot?: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  return locales.ar ?? fallbackRoot ?? emptyBundle();
}

/**
 * Additive migration: copy legacy root into locales.ar only.
 * Never invents Hebrew/English copies from Arabic.
 * Never overwrites an existing locales.ar / locales.he / locales.en.
 */
export function migrateServicePagesDocument(
  incoming?: unknown,
): ServicePagesSettings {
  const raw = asRecord(incoming);
  const localesRaw = asRecord(raw.locales);
  const locales: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>> =
    {};

  for (const locale of SERVICE_CONTENT_LOCALES) {
    const existing = localesRaw[locale];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      locales[locale] = sparseBundle(existing);
    }
  }

  const rootBundle = sparseBundle({
    eyeExam: raw.eyeExam,
    contactLenses: raw.contactLenses,
    homepage: raw.homepage,
    footer: raw.footer,
    catalog: raw.catalog,
    sunglasses: raw.sunglasses,
    frames: raw.frames,
    adminSectionNames: raw.adminSectionNames,
  });

  if (!locales.ar && hasAnyRootContent(raw)) {
    locales.ar = rootBundle;
  }

  const root = syncLegacyRoot(locales, hasAnyRootContent(raw) ? rootBundle : undefined);
  const next: ServicePagesSettings = {
    eyeExam: root.eyeExam,
    contactLenses: root.contactLenses,
    locales,
  };
  if (root.homepage) next.homepage = root.homepage;
  if (root.footer) next.footer = root.footer;
  if (root.catalog) next.catalog = root.catalog;
  if (root.sunglasses) next.sunglasses = root.sunglasses;
  if (root.frames) next.frames = root.frames;
  if (root.adminSectionNames) next.adminSectionNames = root.adminSectionNames;
  const customPages = normalizeCustomPages(raw.customPages);
  if (customPages.length) next.customPages = customPages;
  return next;
}

function fillFromArabicDefaults(saved: unknown): ServicePagesLocaleBundle {
  return   overlayBundle(sparseBundle(saved), {
    eyeExam: DEFAULT_SERVICE_PAGES.eyeExam,
    contactLenses: DEFAULT_SERVICE_PAGES.contactLenses,
    homepage: DEFAULT_SERVICE_PAGES.homepage,
    footer: DEFAULT_SERVICE_PAGES.footer,
    catalog: DEFAULT_SERVICE_PAGES.catalog,
    sunglasses: DEFAULT_SERVICE_PAGES.sunglasses,
    frames: DEFAULT_SERVICE_PAGES.frames,
  });
}

/** Fill missing fields with current production Arabic defaults. Safe for Admin AR form. */
export function mergeServicePages(
  incoming?: unknown,
): ServicePagesSettings {
  const migrated = migrateServicePagesDocument(incoming);
  const filledAr = fillFromArabicDefaults(migrated.locales?.ar ?? migrated);
  const locales: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>> =
    {
      ...migrated.locales,
      ar: filledAr,
    };
  return {
    eyeExam: filledAr.eyeExam,
    contactLenses: filledAr.contactLenses,
    homepage: filledAr.homepage,
    footer: filledAr.footer,
    catalog: filledAr.catalog,
    sunglasses: filledAr.sunglasses,
    frames: filledAr.frames,
    locales,
  };
}

export function hydrateServicePagesForEditor(
  incoming: unknown,
  locale: ServicePagesLocale,
  localeDefaults: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  const migrated = migrateServicePagesDocument(incoming);
  const saved = migrated.locales?.[locale];
  const iconSource = migrated.locales?.ar ?? {
    eyeExam: migrated.eyeExam,
    contactLenses: migrated.contactLenses,
    homepage: migrated.homepage,
    footer: migrated.footer,
    catalog: migrated.catalog,
    sunglasses: migrated.sunglasses,
    frames: migrated.frames,
  };
  const sparse = saved
    ? sparseBundle(saved, iconSource)
    : sparseBundle({}, iconSource);
  return withFallbackHeroMedia(
    overlayBundle(sparse, localeDefaults),
    iconSource,
  );
}

function withFallbackHeroMedia(
  bundle: ServicePagesLocaleBundle,
  source?: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  if (!source) return bundle;
  return {
    ...bundle,
    eyeExam: {
      ...bundle.eyeExam,
      heroMedia: bundle.eyeExam.heroMedia || source.eyeExam.heroMedia,
    },
    contactLenses: {
      ...bundle.contactLenses,
      heroMedia:
        bundle.contactLenses.heroMedia || source.contactLenses.heroMedia,
    },
    catalog:
      bundle.catalog || source.catalog
        ? {
            ...source.catalog,
            ...bundle.catalog,
            heroMedia: bundle.catalog?.heroMedia || source.catalog?.heroMedia,
          }
        : bundle.catalog,
    sunglasses:
      bundle.sunglasses || source.sunglasses
        ? {
            ...source.sunglasses,
            ...bundle.sunglasses,
            heroMedia:
              bundle.sunglasses?.heroMedia || source.sunglasses?.heroMedia,
          }
        : bundle.sunglasses,
    frames:
      bundle.frames || source.frames
        ? {
            ...source.frames,
            ...bundle.frames,
            heroMedia: bundle.frames?.heroMedia || source.frames?.heroMedia,
          }
        : bundle.frames,
  };
}

/**
 * Persist one or more locale copies without inventing missing languages.
 * A patch shaped `{ locales: { he: bundle } }` updates Hebrew only.
 * A legacy root patch (no `locales`) updates Arabic only.
 */
export function persistServicePages(
  stored?: unknown,
  patch?: unknown,
): ServicePagesSettings {
  const current = migrateServicePagesDocument(stored);
  const patchRaw = asRecord(patch);
  const nextLocales: Partial<
    Record<ServicePagesLocale, ServicePagesLocaleBundle>
  > = { ...current.locales };
  const iconSource = nextLocales.ar;

  const patchLocales = asRecord(patchRaw.locales);
  const hasLocalePatch = SERVICE_CONTENT_LOCALES.some(
    (locale) => locale in patchLocales,
  );

  if (hasLocalePatch) {
    for (const locale of SERVICE_CONTENT_LOCALES) {
      if (!(locale in patchLocales)) continue;
      const localePatch = patchLocales[locale];
      nextLocales[locale] = persistBundle(
        nextLocales[locale],
        localePatch,
        iconSource,
        {
          includeHomepage: hasHomepageSettings(localePatch),
          includeFooter: hasFooterSettings(localePatch),
        },
      );
    }
  } else if (hasAnyRootContent(patchRaw)) {
    nextLocales.ar = persistBundle(nextLocales.ar, patchRaw, iconSource, {
      includeHomepage: hasHomepageSettings(patch) || hasHomepageSettings(stored),
      includeFooter: hasFooterSettings(patch) || hasFooterSettings(stored),
    });
  }

  const root = syncLegacyRoot(nextLocales, {
    eyeExam: current.eyeExam,
    contactLenses: current.contactLenses,
    homepage: current.homepage,
    footer: current.footer,
  });

  const next: ServicePagesSettings = {
    eyeExam: root.eyeExam,
    contactLenses: root.contactLenses,
    locales: nextLocales,
  };
  if (root.homepage) next.homepage = root.homepage;
  if (root.footer) next.footer = root.footer;
  if (root.catalog) next.catalog = root.catalog;
  if (root.sunglasses) next.sunglasses = root.sunglasses;
  if (root.frames) next.frames = root.frames;
  if (root.adminSectionNames) next.adminSectionNames = root.adminSectionNames;
  const customPages = persistCustomPages(current.customPages, patchRaw);
  if (customPages.length) next.customPages = customPages;
  return next;
}

function stripAdminEditorMeta(
  bundle: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  const { adminSectionNames: _adminSectionNames, ...rest } = bundle;
  return rest;
}

function stripAdminFromDocument(
  document: ServicePagesSettings,
): ServicePagesSettings {
  const locales: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>> =
    {};
  for (const locale of SERVICE_CONTENT_LOCALES) {
    const saved = document.locales?.[locale];
    if (saved) locales[locale] = stripAdminEditorMeta(saved);
  }
  const next: ServicePagesSettings = {
    ...stripAdminEditorMeta(document),
    locales,
  };
  return next;
}

/** Public whitelist: service-page copy only. Does not invent unsaved Homepage/locales. */
export function publicServicePages(
  incoming?: unknown,
): ServicePagesSettings | undefined {
  if (!incoming || typeof incoming !== "object") return undefined;
  const migrated = stripAdminFromDocument(migrateServicePagesDocument(incoming));
  const customPages = normalizeCustomPages(migrated.customPages).map((page) => ({
    ...page,
    sections: page.sections.map(({ adminLabel: _adminLabel, ...rest }) => rest),
  }));
  if (!hasHomepageSettings(incoming)) {
    const { homepage: _homepage, ...rest } = migrated;
    return customPages.length ? { ...rest, customPages } : rest;
  }
  return customPages.length ? { ...migrated, customPages } : migrated;
}

export function resolveServicePagesForLocale(
  incoming: unknown,
  locale: Locale | ServicePagesLocale,
): ServicePagesLocaleBundle | undefined {
  if (!incoming || typeof incoming !== "object") return undefined;
  const resolved: ServicePagesLocale = isLocale(locale) && isServicePagesLocale(locale)
    ? locale
    : "ar";
  const migrated = migrateServicePagesDocument(incoming);
  const saved = migrated.locales?.[resolved];
  if (saved) {
    return withFallbackHeroMedia(
      saved,
      migrated.locales?.ar ?? {
        eyeExam: migrated.eyeExam,
        contactLenses: migrated.contactLenses,
        homepage: migrated.homepage,
        footer: migrated.footer,
        catalog: migrated.catalog,
        sunglasses: migrated.sunglasses,
        frames: migrated.frames,
      },
    );
  }
  if (resolved === "ar") {
    return {
      eyeExam: migrated.eyeExam,
      contactLenses: migrated.contactLenses,
      homepage: migrated.homepage,
      footer: migrated.footer,
      catalog: migrated.catalog,
      sunglasses: migrated.sunglasses,
      frames: migrated.frames,
    };
  }
  return undefined;
}

export function pickServiceText(
  saved: string | undefined,
  fallback: string,
): string {
  const value = saved?.trim();
  return value || fallback;
}

export function pickServiceFeatures(
  saved: ServicePageFeature[] | undefined,
  fallbacks: Array<{ title: string; description: string; icon?: string }>,
): Array<{ title: string; description: string; icon?: string }> {
  return fallbacks.map((fallback, index) => ({
    title: pickServiceText(saved?.[index]?.title, fallback.title),
    description: pickServiceText(
      saved?.[index]?.description,
      fallback.description,
    ),
    icon: saved?.[index]?.icon || fallback.icon,
  }));
}

export function pickServiceBenefits(
  saved: string[] | undefined,
  fallbacks: string[],
): string[] {
  return fallbacks.map((fallback, index) =>
    pickServiceText(saved?.[index], fallback),
  );
}

export function cloneServicePages(
  pages: ServicePagesSettings = DEFAULT_SERVICE_PAGES,
): ServicePagesSettings {
  return structuredClone(pages);
}

export function cloneLocaleBundle(
  bundle: ServicePagesLocaleBundle,
): ServicePagesLocaleBundle {
  return structuredClone(bundle);
}

export function localePatchPayload(
  locale: ServicePagesLocale,
  bundle: ServicePagesLocaleBundle,
  options?: { includeHomepage?: boolean },
): { locales: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>> } {
  const copy: ServicePagesLocaleBundle = {
    eyeExam: {
      ...bundle.eyeExam,
      heroMedia: bundle.eyeExam.heroMedia ?? null,
    },
    contactLenses: {
      ...bundle.contactLenses,
      heroMedia: bundle.contactLenses.heroMedia ?? null,
    },
    footer: bundle.footer,
    catalog: {
      ...(bundle.catalog || {}),
      heroMedia: bundle.catalog?.heroMedia ?? null,
    },
    sunglasses: {
      ...(bundle.sunglasses || {}),
      heroMedia: bundle.sunglasses?.heroMedia ?? null,
    },
    frames: {
      ...(bundle.frames || {}),
      heroMedia: bundle.frames?.heroMedia ?? null,
    },
    adminSectionNames: bundle.adminSectionNames || {},
  };
  if (options?.includeHomepage !== false && bundle.homepage) {
    copy.homepage = bundle.homepage;
  }
  return { locales: { [locale]: copy } };
}

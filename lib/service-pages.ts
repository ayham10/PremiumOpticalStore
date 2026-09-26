import type {
  ContactLensesServicePage,
  EyeExamServicePage,
  ServicePageFeature,
  ServicePagesSettings,
} from "@/lib/types";

/** Current production Arabic copy — used as Admin defaults / Restore Original. */
export const DEFAULT_SERVICE_PAGES: ServicePagesSettings = {
  eyeExam: {
    eyebrow: "رعاية احترافية",
    title: "فحص نظر شامل",
    description:
      "فحص دقيق بأحدث الأجهزة مع أخصائيين معتمدين لضمان رؤية أوضح وحياة أفضل.",
    bookingButtonText: "احجز فحص نظر",
    features: [
      { title: "أخصائيون معتمدون", description: "خبرة موثوقة" },
      { title: "20 - 30 دقيقة فقط", description: "حجز سريع وسهل" },
      { title: "أجهزة حديثة ودقيقة", description: "نتائج دقيقة" },
      {
        title: "فحص شامل لجميع جوانب الرؤية",
        description: "حدة النظر وصحة العين",
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
      },
      {
        title: "عدسات يومية أو شهرية",
        description: "اختر مدة الاستخدام التي تناسب نمط حياتك.",
      },
      {
        title: "متابعة وإرشاد",
        description: "نصائح حول الراحة والعناية والاستخدام الآمن.",
      },
      {
        title: "سلامة عينيك أولاً",
        description: "ملاءمة مهنية واستخدام يومي حذر.",
      },
    ],
    warningText:
      "يجب اختيار العدسات اللاصقة بملاءمة مهنية. لا تستخدم العدسات لمدة أطول من الموصى بها، وأوقف استخدامها عند الشعور بألم أو احمرار أو انزعاج غير طبيعي.",
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

function mergeFeature(
  saved: unknown,
  fallback: ServicePageFeature,
): ServicePageFeature {
  const row = asRecord(saved);
  return {
    title: cleanText(row.title) || fallback.title,
    description: cleanText(row.description) || fallback.description,
  };
}

function mergeFeatureList(
  saved: unknown,
  fallbacks: ServicePageFeature[],
): ServicePageFeature[] {
  const list = Array.isArray(saved) ? saved : [];
  return fallbacks.map((fallback, index) => mergeFeature(list[index], fallback));
}

function mergeBenefitList(saved: unknown, fallbacks: string[]): string[] {
  const list = Array.isArray(saved) ? saved : [];
  return fallbacks.map((fallback, index) => {
    const value = list[index];
    return typeof value === "string" && value.trim() ? value : fallback;
  });
}

function mergeEyeExam(saved: unknown): EyeExamServicePage {
  const raw = asRecord(saved);
  const base = DEFAULT_SERVICE_PAGES.eyeExam;
  return {
    eyebrow: cleanText(raw.eyebrow) || base.eyebrow,
    title: cleanText(raw.title) || base.title,
    description: cleanText(raw.description) || base.description,
    bookingButtonText:
      cleanText(raw.bookingButtonText) || base.bookingButtonText,
    features: mergeFeatureList(raw.features, base.features),
    benefitsTitle: cleanText(raw.benefitsTitle) || base.benefitsTitle,
    benefits: mergeBenefitList(raw.benefits, base.benefits),
  };
}

function mergeContactLenses(saved: unknown): ContactLensesServicePage {
  const raw = asRecord(saved);
  const base = DEFAULT_SERVICE_PAGES.contactLenses;
  return {
    eyebrow: cleanText(raw.eyebrow) || base.eyebrow,
    title: cleanText(raw.title) || base.title,
    description: cleanText(raw.description) || base.description,
    bookingButtonText:
      cleanText(raw.bookingButtonText) || base.bookingButtonText,
    features: mergeFeatureList(raw.features, base.features),
    warningTitle: cleanText(raw.warningTitle) || base.warningTitle || "",
    warningText: cleanText(raw.warningText) || base.warningText,
  };
}

/** Fill missing fields with current production defaults. Safe for Admin + persist. */
export function mergeServicePages(
  incoming?: unknown,
): ServicePagesSettings {
  const raw = asRecord(incoming);
  return {
    eyeExam: mergeEyeExam(raw.eyeExam),
    contactLenses: mergeContactLenses(raw.contactLenses),
  };
}

/** Public whitelist: service-page copy only. */
export function publicServicePages(
  incoming?: unknown,
): ServicePagesSettings | undefined {
  if (!incoming || typeof incoming !== "object") return undefined;
  return mergeServicePages(incoming);
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
  fallbacks: Array<{ title: string; description: string }>,
): Array<{ title: string; description: string }> {
  return fallbacks.map((fallback, index) => ({
    title: pickServiceText(saved?.[index]?.title, fallback.title),
    description: pickServiceText(
      saved?.[index]?.description,
      fallback.description,
    ),
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

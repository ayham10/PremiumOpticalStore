export const BUILT_IN_PREVIEW_SECTION_IDS = {
  homepageHero: "homepage-hero",
  homepageButtons: "homepage-buttons",
  eyeExamHero: "eyeExam-hero",
  eyeExamButtons: "eyeExam-buttons",
  eyeExamFeatures: "eyeExam-features",
  eyeExamBenefits: "eyeExam-benefits",
  contactLensesHero: "contactLenses-hero",
  contactLensesButtons: "contactLenses-buttons",
  contactLensesFeatures: "contactLenses-features",
  contactLensesNotice: "contactLenses-notice",
  catalogHero: "catalog-hero",
  sunglassesHero: "sunglasses-hero",
  framesHero: "frames-hero",
  footerContent: "footer-content",
} as const;

const BUILT_IN_HERO_SECTION_IDS = new Set<string>([
  BUILT_IN_PREVIEW_SECTION_IDS.homepageHero,
  BUILT_IN_PREVIEW_SECTION_IDS.eyeExamHero,
  BUILT_IN_PREVIEW_SECTION_IDS.contactLensesHero,
  BUILT_IN_PREVIEW_SECTION_IDS.catalogHero,
  BUILT_IN_PREVIEW_SECTION_IDS.sunglassesHero,
  BUILT_IN_PREVIEW_SECTION_IDS.framesHero,
]);

const HERO_SECTION_CLASSES = [
  "home-welcome",
  "eye-exam-hero",
  "cl-hero",
  "store-hero",
  "frames-hero",
];

export function isPreviewHeroSection(
  sectionId: string,
  element?: HTMLElement | null,
): boolean {
  if (BUILT_IN_HERO_SECTION_IDS.has(sectionId)) return true;
  if (!element) return false;
  return HERO_SECTION_CLASSES.some((name) => element.classList.contains(name));
}

export const CONTENT_PREVIEW_LABEL = "oyon-content-preview-label";
export const PREVIEW_EDIT_LABEL_SAFE_TOP = 36;
export const PREVIEW_EDIT_LABEL_HEIGHT = 26;

export type ContentPreviewLabelMessage = {
  type: typeof CONTENT_PREVIEW_LABEL;
  clipped: boolean;
  sectionId: string | null;
};

export function escapePreviewSectionId(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function previewSectionSelector(sectionId: string): string {
  return `[data-csp-section="${escapePreviewSectionId(sectionId)}"]`;
}

export function previewEditingLabel(locale: string): string {
  if (locale === "he") return "✎ בעריכה";
  if (locale === "en") return "✎ Editing";
  return "✎ قيد التعديل";
}

export function shouldClipPreviewEditingLabel(
  sectionTop: number,
  safeTop = PREVIEW_EDIT_LABEL_SAFE_TOP,
): boolean {
  return sectionTop < safeTop;
}

export function isContentPreviewLabelMessage(
  value: unknown,
): value is ContentPreviewLabelMessage {
  if (!value || typeof value !== "object") return false;
  const raw = value as {
    type?: unknown;
    clipped?: unknown;
    sectionId?: unknown;
  };
  return (
    raw.type === CONTENT_PREVIEW_LABEL &&
    typeof raw.clipped === "boolean" &&
    (raw.sectionId === null || typeof raw.sectionId === "string")
  );
}

export function clearPreviewActiveSections(root: ParentNode): void {
  root
    .querySelectorAll("[data-csp-section].is-preview-active")
    .forEach((node) => {
      node.classList.remove(
        "is-preview-active",
        "is-preview-hero",
        "is-preview-label-clipped",
      );
    });
}

export function syncPreviewActiveSection(
  root: ParentNode,
  sectionId: string | null,
  hidden = false,
): { applied: boolean; clipped: boolean; element: HTMLElement | null } {
  clearPreviewActiveSections(root);
  if (!sectionId || hidden) {
    return { applied: false, clipped: false, element: null };
  }
  const el = root.querySelector(previewSectionSelector(sectionId));
  if (!(el instanceof HTMLElement)) {
    return { applied: false, clipped: false, element: null };
  }
  el.classList.add("is-preview-active");
  const hero = isPreviewHeroSection(sectionId, el);
  el.classList.toggle("is-preview-hero", hero);
  const clipped =
    hero || shouldClipPreviewEditingLabel(el.getBoundingClientRect().top);
  el.classList.toggle("is-preview-label-clipped", clipped);
  return { applied: true, clipped, element: el };
}

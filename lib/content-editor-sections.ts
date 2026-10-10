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
  footerContent: "footer-content",
} as const;

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
      node.classList.remove("is-preview-active", "is-preview-label-clipped");
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
  const clipped = shouldClipPreviewEditingLabel(el.getBoundingClientRect().top);
  el.classList.toggle("is-preview-label-clipped", clipped);
  return { applied: true, clipped, element: el };
}

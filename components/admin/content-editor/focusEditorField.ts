export function focusContentEditorField(fieldId: string, sectionId?: string) {
  if (typeof document === "undefined") return;

  if (sectionId) {
    const fold = document.querySelector(
      `[data-csp-editor-section="${cssEscape(sectionId)}"]`,
    );
    const toggle = fold?.querySelector<HTMLButtonElement>(".csp-fold-toggle");
    if (toggle && toggle.getAttribute("aria-expanded") !== "true") {
      toggle.click();
    }
  }

  window.setTimeout(() => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const wrap = el.closest(".admin-service-field") || el;
    wrap.classList.add("is-missing");
    wrap.classList.remove("is-missing-flash");
    void (wrap as HTMLElement).offsetWidth;
    wrap.classList.add("is-missing-flash");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) {
      el.focus({ preventScroll: true });
    }
  }, 80);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

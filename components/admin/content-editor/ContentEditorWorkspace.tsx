"use client";

import { useState, type ReactNode } from "react";
import LivePagePreviews from "@/components/admin/content-editor/LivePagePreviews";
import type { ContentPreviewPayload } from "@/lib/content-editor-preview";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function ContentEditorWorkspace({
  t,
  payload,
  editor,
}: {
  t: Translate;
  payload: ContentPreviewPayload;
  editor: ReactNode;
}) {
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="csp-visual-workspace">
      <div className="csp-mobile-stage-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "edit"}
          className={mobileTab === "edit" ? "is-active" : ""}
          onClick={() => setMobileTab("edit")}
        >
          {t("admin.servicePages.editorTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "preview"}
          className={mobileTab === "preview" ? "is-active" : ""}
          onClick={() => setMobileTab("preview")}
        >
          {t("admin.servicePages.previewTab")}
        </button>
      </div>

      <div
        className={
          mobileTab === "preview"
            ? "csp-visual-grid is-mobile-preview"
            : "csp-visual-grid is-mobile-edit"
        }
      >
        <aside className="csp-visual-previews" aria-label={t("admin.servicePages.preview")}>
          <LivePagePreviews
            payload={payload}
            mobileLabel={t("admin.servicePages.previewMobile")}
            desktopLabel={t("admin.servicePages.previewDesktop")}
          />
        </aside>
        <div className="csp-visual-editor">{editor}</div>
      </div>
    </div>
  );
}

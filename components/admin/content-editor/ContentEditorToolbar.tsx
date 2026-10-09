"use client";

import type { ReactNode } from "react";
import { ExternalLink, Save } from "lucide-react";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function ContentEditorToolbar({
  t,
  saving,
  dirty,
  status,
  localeComplete,
  viewHref,
  onSave,
  extra,
}: {
  t: Translate;
  saving: boolean;
  dirty: boolean;
  status?: "draft" | "published";
  localeComplete?: boolean;
  viewHref: string;
  onSave: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="csp-editor-toolbar">
      <div className="csp-editor-toolbar-status">
        {status ? (
          <span className={status === "published" ? "csp-pill is-live" : "csp-pill"}>
            {status === "published"
              ? t("admin.servicePages.published")
              : t("admin.servicePages.draft")}
          </span>
        ) : null}
        {localeComplete != null ? (
          <span className={localeComplete ? "csp-pill is-live" : "csp-pill is-warn"}>
            {localeComplete
              ? t("admin.servicePages.localeComplete")
              : t("admin.servicePages.localeIncomplete")}
          </span>
        ) : null}
        <span className={dirty ? "csp-unsaved is-dirty" : "csp-unsaved"}>
          <i aria-hidden />
          {dirty
            ? t("admin.servicePages.unsavedChanges")
            : t("admin.servicePages.allSaved")}
        </span>
      </div>
      <div className="csp-editor-toolbar-actions">
        {extra}
        <a
          className="btn btn-ghost"
          href={viewHref}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={15} />
          {t("admin.servicePages.viewPage")}
        </a>
        <button
          type="button"
          className="btn btn-accent"
          onClick={onSave}
          disabled={saving}
        >
          <Save size={15} />
          {saving ? t("admin.servicePages.saving") : t("admin.servicePages.save")}
        </button>
      </div>
    </div>
  );
}

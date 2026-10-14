"use client";

import type { ContentFieldIssue } from "@/lib/content-editor-validation";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function MissingFieldsBanner({
  issues,
  t,
  onSelect,
  saveIsLive = false,
}: {
  issues: ContentFieldIssue[];
  t: Translate;
  onSelect: (issue: ContentFieldIssue) => void;
  saveIsLive?: boolean;
}) {
  if (!issues.length) return null;
  const saveIssues = issues.filter((issue) => issue.requirement === "save");
  const displayIssues = issues.filter((issue) => issue.requirement === "display");

  return (
    <div className="csp-issues-panel" role="status">
      <div className="csp-issues-legend">
        {saveIssues.length ? (
          <span className="csp-req csp-req-save">
            {t("admin.servicePages.requiredToSave")}
          </span>
        ) : null}
        {displayIssues.length ? (
          <span className="csp-req csp-req-display">
            {saveIsLive
              ? t("admin.servicePages.requiredToDisplayLive")
              : t("admin.servicePages.requiredToDisplay")}
          </span>
        ) : null}
      </div>
      {saveIssues.length ? (
        <ul className="csp-issues csp-issues-clickable">
          {saveIssues.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item)}>
                {t(item.messageKey, item.messageVars)}
                <small>{t("admin.servicePages.requiredToSave")}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {displayIssues.length ? (
        <>
          <p className="csp-issues-note">
            {saveIsLive
              ? t("admin.servicePages.displayMissingLiveHint")
              : t("admin.servicePages.displayMissingHint")}
          </p>
          <ul className="csp-issues csp-issues-clickable">
            {displayIssues.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onSelect(item)}>
                  {t(item.messageKey, item.messageVars)}
                  <small>
                    {saveIsLive
                      ? t("admin.servicePages.requiredToDisplayLive")
                      : t("admin.servicePages.requiredToDisplay")}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

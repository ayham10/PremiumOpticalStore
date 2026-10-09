"use client";

import { ExternalLink, Files, Pencil } from "lucide-react";
import type { CustomServicePage } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function CustomPagesPanel({
  pages,
  selectedId,
  t,
  onEdit,
  onCollapse,
}: {
  pages: CustomServicePage[];
  selectedId: string | null;
  t: Translate;
  onEdit: (page: CustomServicePage) => void;
  onCollapse: () => void;
}) {
  return (
    <section className="csp-my-pages" aria-labelledby="csp-my-pages-title">
      <header className="csp-my-pages-head">
        <div>
          <h2 id="csp-my-pages-title">
            <Files size={16} strokeWidth={1.7} aria-hidden />
            {t("admin.servicePages.myPages")}
          </h2>
          <p className="admin-muted">
            {t("admin.servicePages.myPagesCount", { n: pages.length })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCollapse}
        >
          {t("admin.servicePages.hideMyPages")}
        </button>
      </header>

      {pages.length === 0 ? (
        <p className="csp-my-pages-empty">{t("admin.servicePages.noPages")}</p>
      ) : (
        <ul className="csp-my-pages-list">
          {pages.map((page) => {
            const selected = page.id === selectedId;
            const live = page.status === "published";
            return (
              <li
                key={page.id}
                className={selected ? "csp-my-page is-selected" : "csp-my-page"}
              >
                <button
                  type="button"
                  className="csp-my-page-main"
                  onClick={() => onEdit(page)}
                >
                  <span className="csp-my-page-name">{page.name}</span>
                  <span className="csp-my-page-slug" dir="ltr">
                    /services/{page.slug}
                  </span>
                </button>
                <span className={live ? "csp-pill is-live" : "csp-pill"}>
                  {live
                    ? t("admin.servicePages.published")
                    : t("admin.servicePages.draft")}
                </span>
                <span className="csp-my-page-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onEdit(page)}
                  >
                    <Pencil size={14} strokeWidth={1.7} />
                    {t("admin.servicePages.editPage")}
                  </button>
                  {live ? (
                    <a
                      className="btn btn-ghost"
                      href={`/services/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} strokeWidth={1.7} />
                      {t("admin.servicePages.viewPage")}
                    </a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

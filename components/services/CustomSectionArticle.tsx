import { isRtl, type Locale } from "@/lib/i18n/config";
import type { CustomArticleAlign, ServicePagesLocale } from "@/lib/types";

export function CustomSectionArticle({
  heading,
  body,
  align,
  locale,
}: {
  heading: string;
  body: string;
  align: CustomArticleAlign;
  locale: ServicePagesLocale | Locale;
}) {
  const title = heading.trim();
  const text = body.trim();
  if (!title && !text) return null;

  const dir = isRtl(locale as Locale) ? "rtl" : "ltr";

  return (
    <div className={`csp-article is-${align}`}>
      {title ? (
        <div className="csp-article-heading" dir="ltr">
          {align === "center" || align === "right" ? (
            <span className="csp-article-rule is-before" aria-hidden />
          ) : null}
          <h2 className="csp-article-title" dir={dir} lang={locale}>
            {title}
          </h2>
          {align === "center" || align === "left" ? (
            <span className="csp-article-rule is-after" aria-hidden />
          ) : null}
        </div>
      ) : null}
      {text ? (
        <p className="csp-article-body" dir={dir} lang={locale}>
          {text}
        </p>
      ) : null}
    </div>
  );
}

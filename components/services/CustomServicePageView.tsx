"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, Lock, Target } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  filledText,
  isExternalCta,
  resolveCtaHref,
  resolveSectionArticle,
  visibleCustomBenefits,
  visibleCustomFeatures,
  visibleCustomSections,
} from "@/lib/custom-service-pages";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  resolveServiceFeatureIcon,
} from "@/lib/service-page-icons";
import CustomPageProductsCarousel, {
  type CustomPageProductCard,
} from "@/components/services/CustomPageProductsCarousel";
import { CustomSectionArticle } from "@/components/services/CustomSectionArticle";
import ResponsiveHeroImage from "@/components/media/ResponsiveHeroImage";
import type {
  CustomPageCopy,
  CustomPageMediaRef,
  CustomPageSection,
  CustomServicePage,
  ServicePagesLocale,
} from "@/lib/types";

function HeroMedia({
  media,
  title,
  variant,
  placeholder,
}: {
  media?: CustomPageMediaRef;
  title: string;
  variant: "eye-exam" | "contact-lenses";
  placeholder?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className =
    variant === "contact-lenses" ? "cl-hero-media" : "eye-exam-hero-media";
  if (!media?.url || failed) {
    return (
      <div
        className={placeholder ? `${className} csp-preview-ph-media` : className}
        aria-hidden
      />
    );
  }
  if (media.kind === "video") {
    return (
      <div className={className}>
        <video
          className={variant === "contact-lenses" ? "cl-hero-video" : undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onError={() => setFailed(true)}
        >
          <source src={media.url} />
        </video>
      </div>
    );
  }
  return (
    <div className={className}>
      <ResponsiveHeroImage media={media} alt={title} className="csp-hero-fill" />
    </div>
  );
}

function GalleryItem({ item }: { item: CustomPageMediaRef }) {
  const [failed, setFailed] = useState(false);
  if (failed || !item.url) {
    return <div className="csp-gallery-item csp-gallery-missing" aria-hidden />;
  }
  return (
    <div className="csp-gallery-item">
      {item.kind === "video" ? (
        <video
          src={item.url}
          muted
          playsInline
          controls
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <Image
          src={item.url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function PageCta({
  page,
  copy,
  isCl,
}: {
  page: CustomServicePage;
  copy: CustomPageCopy;
  isCl: boolean;
}) {
  const href = resolveCtaHref(page);
  const label = copy.bookingButtonText.trim();
  if (!href || !label) return null;
  const className = `btn btn-copper ${isCl ? "cl-book-btn" : "eye-exam-btn"}`;
  if (isExternalCta(page)) {
    return (
      <div className={isCl ? "cl-hero-actions" : "eye-exam-actions"}>
        <a
          href={href}
          className={className}
          rel="noopener noreferrer"
          target="_blank"
        >
          {label}
        </a>
      </div>
    );
  }
  return (
    <div className={isCl ? "cl-hero-actions" : "eye-exam-actions"}>
      <Link href={href} className={className}>
        {label}
      </Link>
    </div>
  );
}

function sectionClass(
  _sectionId: string,
  _activeSectionId?: string | null,
  extra?: string,
): string {
  return extra || "";
}

function SectionArticle({
  section,
  locale,
}: {
  section: CustomPageSection;
  locale: ServicePagesLocale;
}) {
  const article = resolveSectionArticle(section, locale);
  if (!article) return null;
  return (
    <CustomSectionArticle
      heading={article.heading}
      body={article.body}
      align={article.align}
      locale={locale}
    />
  );
}

function withSectionArticle(
  section: CustomPageSection,
  locale: ServicePagesLocale,
  inner: ReactNode,
) {
  const article = resolveSectionArticle(section, locale);
  if (!article) return inner;
  if (article.position === "after") {
    return (
      <>
        {inner}
        <SectionArticle section={section} locale={locale} />
      </>
    );
  }
  return (
    <>
      <SectionArticle section={section} locale={locale} />
      {inner}
    </>
  );
}

function BodySection({
  section,
  page,
  copy,
  isCl,
  products,
  currencySymbol,
  dir,
  locale,
  activeSectionId,
}: {
  section: CustomPageSection;
  page: CustomServicePage;
  copy: CustomPageCopy;
  isCl: boolean;
  products: CustomPageProductCard[];
  currencySymbol?: string;
  dir?: "ltr" | "rtl";
  locale: ServicePagesLocale;
  activeSectionId?: string | null;
}) {
  const hasArticle = Boolean(resolveSectionArticle(section, locale));

  if (section.type === "featureGrid") {
    const features = visibleCustomFeatures(copy.features);
    if (!features.length && !hasArticle) return null;
    const grid = features.length ? (
      isCl ? (
        <div className="cl-features-grid">
          {features.map((feature, index) => {
            const Icon = resolveServiceFeatureIcon(
              feature.icon,
              CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ?? "shield-check",
            );
            return (
              <article key={`${section.id}-${index}`} className="cl-feature">
                <span className="cl-feature-orb" aria-hidden>
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <div className="cl-feature-copy">
                  {filledText(feature.title) ? (
                    <h2 className="cl-feature-title">{feature.title}</h2>
                  ) : null}
                  {filledText(feature.description) ? (
                    <p className="cl-feature-text">{feature.description}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="eye-exam-features-grid">
          {features.map((feature, index) => {
            const Icon = resolveServiceFeatureIcon(
              feature.icon,
              EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ?? "eye",
            );
            return (
              <article key={`${section.id}-${index}`} className="eye-exam-feature">
                <span className="eye-exam-feature-orb" aria-hidden>
                  <Icon size={22} strokeWidth={1.85} />
                </span>
                <div className="eye-exam-feature-copy">
                  {filledText(feature.title) ? (
                    <p className="eye-exam-feature-title">{feature.title}</p>
                  ) : null}
                  {filledText(feature.description) ? (
                    <p className="eye-exam-feature-lead">{feature.description}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )
    ) : null;
    return (
      <section
        className={sectionClass(
          section.id,
          activeSectionId,
          isCl ? "cl-features" : "eye-exam-features",
        )}
        data-csp-section={section.id}
      >
        {withSectionArticle(section, locale, grid)}
      </section>
    );
  }

  if (section.type === "benefitsList") {
    const items = visibleCustomBenefits(copy.benefits);
    const title = filledText(copy.benefitsTitle);
    if (!items.length && !hasArticle) return null;
    const list = items.length ? (
      <>
        {title ? (
          <h2 className="eye-exam-benefits-title">
            <span>{title}</span>
            <span className="eye-exam-benefits-rule" aria-hidden />
          </h2>
        ) : null}
        <ul className="eye-exam-benefits-list">
          {items.map((item, index) => (
            <li key={`${section.id}-${index}`}>
              <span className="eye-exam-check-orb" aria-hidden>
                <Check size={13} strokeWidth={2.4} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ) : null;
    return (
      <section
        className={sectionClass(section.id, activeSectionId, "eye-exam-benefits")}
        data-csp-section={section.id}
      >
        {withSectionArticle(section, locale, list)}
      </section>
    );
  }

  if (section.type === "notice") {
    const warningText = filledText(copy.warningText);
    const warningTitle = filledText(copy.warningTitle);
    if (!warningText && !hasArticle) return null;
    const note = warningText ? (
      <p>
        {warningTitle ? <strong>{warningTitle} </strong> : null}
        {warningText}
      </p>
    ) : null;
    return (
      <aside
        className={sectionClass(section.id, activeSectionId, "cl-safety")}
        data-csp-section={section.id}
        role="note"
      >
        {withSectionArticle(section, locale, note)}
      </aside>
    );
  }

  if (section.type === "valuesStrip") {
    const valuesTitle = filledText(copy.valuesTitle);
    const valuesText = filledText(copy.valuesText);
    const privacyText = filledText(copy.privacyText);
    const hasValues = Boolean(valuesTitle || valuesText);
    if (!hasValues && !privacyText && !hasArticle) return null;
    const strip =
      hasValues || privacyText ? (
      <>
        {hasValues ? (
        <section className="eye-exam-accuracy">
          <span className="eye-exam-accuracy-orb" aria-hidden>
            <Target size={16} strokeWidth={1.7} />
          </span>
          {valuesTitle ? (
            <h2 className="eye-exam-accuracy-title">{valuesTitle}</h2>
          ) : null}
          {valuesText ? (
            <p className="eye-exam-accuracy-text">{valuesText}</p>
          ) : null}
        </section>
        ) : null}
        {privacyText ? (
          <p className="eye-exam-privacy">
            <Lock size={14} aria-hidden strokeWidth={1.7} />
            <span>{privacyText}</span>
          </p>
        ) : null}
      </>
      ) : null;
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        {withSectionArticle(section, locale, strip)}
      </div>
    );
  }

  if (section.type === "bookingCta") {
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        {withSectionArticle(
          section,
          locale,
          <PageCta page={page} copy={copy} isCl={isCl} />,
        )}
      </div>
    );
  }

  if (section.type === "gallery") {
    const items = (page.gallery || []).filter((item) => item.url);
    if (!items.length && !hasArticle) return null;
    const gallery = items.length ? (
      <>
        {items.map((item, index) => (
          <GalleryItem key={`${item.url}-${index}`} item={item} />
        ))}
      </>
    ) : null;
    return (
      <div
        className={sectionClass(section.id, activeSectionId, "csp-gallery")}
        data-csp-section={section.id}
      >
        {withSectionArticle(section, locale, gallery)}
      </div>
    );
  }

  if (section.type === "products") {
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        {withSectionArticle(
          section,
          locale,
          <CustomPageProductsCarousel
            products={products}
            currencySymbol={currencySymbol}
            dir={dir}
          />,
        )}
      </div>
    );
  }

  return hasArticle ? (
    <div
      className={sectionClass(section.id, activeSectionId)}
      data-csp-section={section.id}
    >
      <SectionArticle section={section} locale={locale} />
    </div>
  ) : null;
}

export default function CustomServicePageView({
  page,
  copy,
  dir,
  products = [],
  currencySymbol,
  activeSectionId,
  previewPlaceholders,
}: {
  page: CustomServicePage;
  copy: CustomPageCopy;
  dir?: "ltr" | "rtl";
  products?: CustomPageProductCard[];
  currencySymbol?: string;
  activeSectionId?: string | null;
  previewPlaceholders?: boolean;
}) {
  const { rtl, locale } = useLocale();
  const pageLocale = locale as ServicePagesLocale;
  const isCl = page.template === "contact-lenses";
  const visible = visibleCustomSections(page.sections);
  const hero = visible.find((section) => section.type === "heroMedia");
  const body = visible.filter((section) => section.type !== "heroMedia");
  const pageDir = dir ?? (rtl ? "rtl" : "ltr");
  const heroCopy = (
    <>
      {filledText(copy.eyebrow) ? (
        <p className={isCl ? "cl-eyebrow" : "eye-exam-eyebrow"}>{copy.eyebrow}</p>
      ) : null}
      {filledText(copy.title) ? (
        <h1 className={isCl ? "cl-title" : "eye-exam-title"}>{copy.title}</h1>
      ) : null}
      {filledText(copy.description) ? (
        <p className={isCl ? "cl-description" : "eye-exam-description"}>
          {copy.description}
        </p>
      ) : null}
      {page.showHeroButton ? (
        <PageCta page={page} copy={copy} isCl={isCl} />
      ) : null}
    </>
  );

  return (
    <div
      className={isCl ? "frames-page cl-page" : "eye-exam-page"}
      dir={pageDir}
    >
      {hero ? (
        isCl ? (
          <section
            className={sectionClass(hero.id, activeSectionId, "cl-hero")}
            data-csp-section={hero.id}
            aria-label={copy.title}
          >
            <HeroMedia
              media={page.heroMedia}
              title={copy.title}
              variant="contact-lenses"
              placeholder={previewPlaceholders}
            />
            <span className="cl-hero-veil" aria-hidden />
            <div className="cl-hero-copy">
              {withSectionArticle(hero, pageLocale, heroCopy)}
            </div>
          </section>
        ) : (
          <section
            className={sectionClass(hero.id, activeSectionId, "eye-exam-hero")}
            data-csp-section={hero.id}
            aria-label={copy.title}
          >
            <HeroMedia
              media={page.heroMedia}
              title={copy.title}
              variant="eye-exam"
              placeholder={previewPlaceholders}
            />
            <div className="eye-exam-hero-copy">
              {withSectionArticle(hero, pageLocale, heroCopy)}
            </div>
          </section>
        )
      ) : null}

      <div className={isCl ? "cl-inner" : "eye-exam-inner"}>
        {!hero ? (
          <header
            className={sectionClass("page-copy", activeSectionId, "csp-inline-hero")}
            data-csp-section="page-copy"
          >
            {heroCopy}
          </header>
        ) : null}
        {body.map((section) => (
          <BodySection
            key={section.id}
            section={section}
            page={page}
            copy={copy}
            isCl={isCl}
            products={products}
            currencySymbol={currencySymbol}
            dir={pageDir}
            locale={pageLocale}
            activeSectionId={activeSectionId}
          />
        ))}
        {products.length && !visible.some((section) => section.type === "products") ? (
          <CustomPageProductsCarousel
            products={products}
            currencySymbol={currencySymbol}
            dir={pageDir}
          />
        ) : null}
      </div>
    </div>
  );
}

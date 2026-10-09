"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Lock, Target } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  isExternalCta,
  resolveCtaHref,
} from "@/lib/custom-service-pages";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  resolveServiceFeatureIcon,
} from "@/lib/service-page-icons";
import CustomPageProductsCarousel, {
  type CustomPageProductCard,
} from "@/components/services/CustomPageProductsCarousel";
import ResponsiveHeroImage from "@/components/media/ResponsiveHeroImage";
import { visibleCustomSections } from "@/lib/custom-service-pages";
import type {
  CustomPageCopy,
  CustomPageMediaRef,
  CustomPageSection,
  CustomServicePage,
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
  sectionId: string,
  activeSectionId?: string | null,
  extra?: string,
): string {
  const active = activeSectionId === sectionId ? "is-preview-active" : "";
  return [extra, active].filter(Boolean).join(" ");
}

function BodySection({
  section,
  page,
  copy,
  isCl,
  products,
  currencySymbol,
  dir,
  activeSectionId,
}: {
  section: CustomPageSection;
  page: CustomServicePage;
  copy: CustomPageCopy;
  isCl: boolean;
  products: CustomPageProductCard[];
  currencySymbol?: string;
  dir?: "ltr" | "rtl";
  activeSectionId?: string | null;
}) {
  if (section.type === "featureGrid") {
    const features = copy.features.filter(
      (feature) => feature.title || feature.description,
    );
    if (!features.length) return null;
    return isCl ? (
      <section
        className={sectionClass(section.id, activeSectionId, "cl-features")}
        data-csp-section={section.id}
      >
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
                  <h2 className="cl-feature-title">{feature.title}</h2>
                  <p className="cl-feature-text">{feature.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : (
      <section
        className={sectionClass(section.id, activeSectionId, "eye-exam-features")}
        data-csp-section={section.id}
      >
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
                  <p className="eye-exam-feature-title">{feature.title}</p>
                  <p className="eye-exam-feature-lead">{feature.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (section.type === "benefitsList") {
    const items = copy.benefits.filter(Boolean);
    if (!items.length) return null;
    return (
      <section
        className={sectionClass(section.id, activeSectionId, "eye-exam-benefits")}
        data-csp-section={section.id}
      >
        <h2 className="eye-exam-benefits-title">
          <span>{copy.benefitsTitle}</span>
          <span className="eye-exam-benefits-rule" aria-hidden />
        </h2>
        <ul className="eye-exam-benefits-list">
          {items.map((item) => (
            <li key={item}>
              <span className="eye-exam-check-orb" aria-hidden>
                <Check size={13} strokeWidth={2.4} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (section.type === "notice" && copy.warningText) {
    return (
      <aside
        className={sectionClass(section.id, activeSectionId, "cl-safety")}
        data-csp-section={section.id}
        role="note"
      >
        <p>
          {copy.warningTitle ? <strong>{copy.warningTitle} </strong> : null}
          {copy.warningText}
        </p>
      </aside>
    );
  }

  if (section.type === "valuesStrip") {
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        <section className="eye-exam-accuracy">
          <span className="eye-exam-accuracy-orb" aria-hidden>
            <Target size={16} strokeWidth={1.7} />
          </span>
          <h2 className="eye-exam-accuracy-title">{copy.valuesTitle}</h2>
          <p className="eye-exam-accuracy-text">{copy.valuesText}</p>
        </section>
        {copy.privacyText ? (
          <p className="eye-exam-privacy">
            <Lock size={14} aria-hidden strokeWidth={1.7} />
            <span>{copy.privacyText}</span>
          </p>
        ) : null}
      </div>
    );
  }

  if (section.type === "bookingCta") {
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        <PageCta page={page} copy={copy} isCl={isCl} />
      </div>
    );
  }

  if (section.type === "gallery") {
    const items = (page.gallery || []).filter((item) => item.url);
    if (!items.length) return null;
    return (
      <div
        className={sectionClass(section.id, activeSectionId, "csp-gallery")}
        data-csp-section={section.id}
      >
        {items.map((item, index) => (
          <GalleryItem key={`${item.url}-${index}`} item={item} />
        ))}
      </div>
    );
  }

  if (section.type === "products") {
    return (
      <div
        className={sectionClass(section.id, activeSectionId)}
        data-csp-section={section.id}
      >
        <CustomPageProductsCarousel
          products={products}
          currencySymbol={currencySymbol}
          dir={dir}
        />
      </div>
    );
  }

  return null;
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
  const { rtl } = useLocale();
  const isCl = page.template === "contact-lenses";
  const visible = visibleCustomSections(page.sections);
  const hero = visible.find((section) => section.type === "heroMedia");
  const body = visible.filter((section) => section.type !== "heroMedia");
  const pageDir = dir ?? (rtl ? "rtl" : "ltr");

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
              {copy.eyebrow ? <p className="cl-eyebrow">{copy.eyebrow}</p> : null}
              <h1 className="cl-title">{copy.title}</h1>
              <p className="cl-description">{copy.description}</p>
              {page.showHeroButton ? (
                <PageCta page={page} copy={copy} isCl />
              ) : null}
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
              {copy.eyebrow ? (
                <p className="eye-exam-eyebrow">{copy.eyebrow}</p>
              ) : null}
              <h1 className="eye-exam-title">{copy.title}</h1>
              <p className="eye-exam-description">{copy.description}</p>
              {page.showHeroButton ? (
                <PageCta page={page} copy={copy} isCl={false} />
              ) : null}
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
            {copy.eyebrow ? (
              <p className={isCl ? "cl-eyebrow" : "eye-exam-eyebrow"}>{copy.eyebrow}</p>
            ) : null}
            <h1 className={isCl ? "cl-title" : "eye-exam-title"}>{copy.title}</h1>
            <p className={isCl ? "cl-description" : "eye-exam-description"}>
              {copy.description}
            </p>
            {page.showHeroButton ? (
              <PageCta page={page} copy={copy} isCl={isCl} />
            ) : null}
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

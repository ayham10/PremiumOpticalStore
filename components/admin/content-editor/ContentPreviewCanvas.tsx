"use client";

import { memo, useEffect } from "react";
import ContactLensesPage from "@/components/contact-lenses/ContactLensesPage";
import EyeExamPage from "@/components/eye-exam/EyeExamPage";
import Footer from "@/components/Footer";
import NavigationHub from "@/components/home/NavigationHub";
import WelcomeSection from "@/components/home/WelcomeSection";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import CustomServicePageView from "@/components/services/CustomServicePageView";
import {
  copyForCustomPageEditor,
  visibleCustomSections,
} from "@/lib/custom-service-pages";
import { editorPanelDir, type ContentPreviewPayload } from "@/lib/content-editor-preview";
import { isRtl, type Locale } from "@/lib/i18n/config";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import he from "@/lib/i18n/dictionaries/he";
import {
  previewPlaceholderProducts,
  withPreviewPlaceholders,
} from "@/lib/preview-placeholders";
import { ServicePagesPreviewProvider } from "@/lib/use-service-pages";

const DICTS = { ar, he, en } as const;

function escapeSectionId(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function PreviewBody({ payload }: { payload: ContentPreviewPayload }) {
  const dir = editorPanelDir(payload.locale);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (payload.kind === "homepage") {
    return (
      <div className="home-page home-main">
        <WelcomeSection />
        <NavigationHub />
      </div>
    );
  }
  if (payload.kind === "eyeExam") {
    return <EyeExamPage />;
  }
  if (payload.kind === "contactLenses") {
    return <ContactLensesPage />;
  }
  if (payload.kind === "footer") {
    return (
      <div className="csp-preview-footer-wrap" data-csp-section="footer-content">
        <Footer />
      </div>
    );
  }

  const page = payload.customPage;
  if (!page) return null;
  const savedCopy = copyForCustomPageEditor(page, payload.locale);
  const copy = payload.previewPlaceholders
    ? withPreviewPlaceholders(savedCopy, payload.locale)
    : savedCopy;
  const wantsProducts = visibleCustomSections(page.sections).some(
    (section) => section.type === "products",
  );
  const products =
    payload.products && payload.products.length
      ? payload.products
      : payload.previewPlaceholders && wantsProducts
        ? previewPlaceholderProducts(payload.locale)
        : [];
  return (
    <CustomServicePageView
      page={page}
      copy={copy}
      dir={dir}
      products={products}
      activeSectionId={payload.activeSectionId}
      previewPlaceholders={payload.previewPlaceholders}
    />
  );
}

function ContentPreviewCanvas({
  payload,
}: {
  payload: ContentPreviewPayload;
}) {
  const locale = payload.locale as Locale;
  const dict = DICTS[payload.locale];

  useEffect(() => {
    document.documentElement.classList.remove("admin-dark");
    document.body.classList.remove("admin-dark");
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const id = payload.activeSectionId;
    document
      .querySelectorAll("[data-csp-section].is-preview-active")
      .forEach((node) => node.classList.remove("is-preview-active"));
    if (!id) return;
    const hidden = payload.customPage?.sections.some(
      (section) => section.id === id && section.hidden,
    );
    if (hidden) return;
    const el = document.querySelector(
      `[data-csp-section="${escapeSectionId(id)}"]`,
    );
    if (!(el instanceof HTMLElement)) return;
    el.classList.add("is-preview-active");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [payload.activeSectionId, payload.kind, payload.customPage?.id]);

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <ServicePagesPreviewProvider value={payload.document}>
        <div className="csp-preview-canvas">
          <PreviewBody
            key={`${payload.kind}:${payload.locale}`}
            payload={payload}
          />
        </div>
      </ServicePagesPreviewProvider>
    </LocaleProvider>
  );
}

export default memo(ContentPreviewCanvas);

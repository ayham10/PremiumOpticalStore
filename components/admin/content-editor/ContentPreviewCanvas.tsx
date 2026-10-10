"use client";

import { memo, useEffect, useRef, useState } from "react";
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
import {
  CONTENT_PREVIEW_LABEL,
  PREVIEW_EDIT_LABEL_HEIGHT,
  previewEditingLabel,
  syncPreviewActiveSection,
} from "@/lib/content-editor-sections";
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [floatLabel, setFloatLabel] = useState<{
    top: number;
    start: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("admin-dark");
    document.body.classList.remove("admin-dark");
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const id = payload.activeSectionId || null;
    const hidden = Boolean(
      id &&
        payload.customPage?.sections.some(
          (section) => section.id === id && section.hidden,
        ),
    );
    const next = syncPreviewActiveSection(document, id, hidden);
    const text = previewEditingLabel(locale);

    function postLabel(clipped: boolean, sectionId: string | null) {
      window.parent.postMessage(
        { type: CONTENT_PREVIEW_LABEL, clipped, sectionId },
        window.location.origin,
      );
    }

    if (!next.element || !canvasRef.current) {
      setFloatLabel(null);
      postLabel(false, next.applied ? id : null);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const elRect = next.element.getBoundingClientRect();
    const clipped =
      next.clipped ||
      elRect.top - canvasRect.top < PREVIEW_EDIT_LABEL_HEIGHT + 8;
    if (clipped) {
      setFloatLabel(null);
      postLabel(true, id);
      return;
    }

    setFloatLabel({
      top: elRect.top - canvasRect.top - PREVIEW_EDIT_LABEL_HEIGHT - 8,
      start: isRtl(locale)
        ? canvasRect.right - elRect.right
        : elRect.left - canvasRect.left,
      text,
    });
    postLabel(false, id);
  }, [payload.activeSectionId, payload.kind, payload.customPage?.id, locale]);

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <ServicePagesPreviewProvider value={payload.document}>
        <div className="csp-preview-canvas" ref={canvasRef}>
          <PreviewBody
            key={`${payload.kind}:${payload.locale}`}
            payload={payload}
          />
          {floatLabel ? (
            <span
              className="csp-preview-edit-label"
              style={{
                top: floatLabel.top,
                insetInlineStart: floatLabel.start,
              }}
              aria-hidden
            >
              {floatLabel.text}
            </span>
          ) : null}
        </div>
      </ServicePagesPreviewProvider>
    </LocaleProvider>
  );
}

export default memo(ContentPreviewCanvas);

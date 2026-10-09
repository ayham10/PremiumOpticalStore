"use client";

import { memo, useEffect } from "react";
import ContactLensesPage from "@/components/contact-lenses/ContactLensesPage";
import EyeExamPage from "@/components/eye-exam/EyeExamPage";
import Footer from "@/components/Footer";
import NavigationHub from "@/components/home/NavigationHub";
import WelcomeSection from "@/components/home/WelcomeSection";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import CustomServicePageView from "@/components/services/CustomServicePageView";
import { copyForCustomPageEditor } from "@/lib/custom-service-pages";
import { editorPanelDir, type ContentPreviewPayload } from "@/lib/content-editor-preview";
import { isRtl, type Locale } from "@/lib/i18n/config";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import he from "@/lib/i18n/dictionaries/he";
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
      <div className="csp-preview-footer-wrap">
        <Footer />
      </div>
    );
  }

  const page = payload.customPage;
  if (!page) return null;
  const copy = copyForCustomPageEditor(page, payload.locale);
  return (
    <CustomServicePageView
      page={page}
      copy={copy}
      dir={dir}
      products={payload.products || []}
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

"use client";

import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function HomeFooter() {
  const { t } = useLocale();
  const { branding } = useBranding();
  const year = new Date().getFullYear();

  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <BrandMark
          branding={branding}
          href="/"
          className="home-footer-brand"
          suffix={t("hero.brandSuffix")}
          onDark
        />

        <div className="home-footer-social" aria-label="Social">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="home-footer-social-link"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="home-footer-social-link"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
            </svg>
          </a>
          <a
            href="https://wa.me/9725550180"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="home-footer-social-link"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9 9 0 1 1 12 20.5z" />
            </svg>
          </a>
        </div>

        <p className="home-footer-copy">
          {t("footer.copyright", { year })}
        </p>
      </div>
    </footer>
  );
}

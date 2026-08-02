"use client";

import Link from "next/link";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function Footer() {
  const { t } = useLocale();
  const { branding, settings } = useBranding();

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--ink)] text-white">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandMark branding={branding} href="/" size="lg" onDark />
          <p className="mt-4 max-w-sm text-[0.95rem] text-white/65">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            {t("footer.visit")}
          </div>
          <p className="mt-4 text-white/75">
            {settings?.address || "Main Street"}
            <br />
            {settings?.city || "Deir Hanna"}
          </p>
          <p className="mt-3 text-white/75">{settings?.phone || "+972-52-123-4567"}</p>
          <p className="text-white/75">{settings?.email || "hello@oyon.optics"}</p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            {t("footer.explore")}
          </div>
          <div className="mt-4 flex flex-col gap-2 text-white/75">
            <Link href="/shop">{t("nav.shop")}</Link>
            <Link href="/services">{t("nav.services")}</Link>
            <Link href="/book">{t("nav.book")}</Link>
            <Link href="/gallery">{t("nav.gallery")}</Link>
            <Link href="/contact">{t("nav.contact")}</Link>
            <Link href="/admin">{t("nav.admin")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-2 py-5 text-sm text-white/45 md:flex-row md:justify-between">
          <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
          <span>{t("footer.short")}</span>
        </div>
      </div>
    </footer>
  );
}

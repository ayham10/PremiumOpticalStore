"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--ink)] text-white">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
            LUM<span style={{ color: "#7eb6d8" }}>I</span>NA
          </div>
          <p className="mt-4 max-w-sm text-[0.95rem] text-white/65">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            {t("footer.visit")}
          </div>
          <p className="mt-4 text-white/75">
            128 King George Street
            <br />
            Tel Aviv
          </p>
          <p className="mt-3 text-white/75">+972-3-555-0180</p>
          <p className="text-white/75">hello@lumina.optics</p>
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

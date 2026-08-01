"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function Navbar() {
  const { t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/services", label: t("nav.services") },
    { href: "/shop", label: t("nav.shop") },
    { href: "/book", label: t("nav.book") },
    { href: "/gallery", label: t("nav.gallery") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-[var(--line)] bg-[rgba(247,248,250,0.92)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="wrap flex items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className={`font-[family-name:var(--font-display)] text-[1.55rem] tracking-[0.08em] ${
            scrolled || open ? "text-[var(--ink)]" : "text-white"
          }`}
        >
          LUM<span style={{ color: scrolled || open ? "var(--accent)" : "#9ec9e6" }}>I</span>NA
        </Link>

        <nav
          className={`hidden items-center gap-6 text-[0.92rem] font-medium lg:flex ${
            scrolled ? "text-[var(--slate)]" : "text-white/85"
          }`}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-[var(--accent-soft)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className={scrolled || open ? "" : "[&_select]:border-white/35 [&_select]:bg-white/15 [&_select]:text-white"}>
            <LanguageSwitcher compact />
          </div>
          <Link
            href="/admin"
            className={`text-sm ${scrolled ? "text-[var(--slate)]" : "text-white/75"}`}
          >
            {t("nav.admin")}
          </Link>
          <Link href="/book" className="btn btn-primary !min-h-11 !px-5 !text-sm">
            {t("nav.bookCta")}
          </Link>
        </div>

        <button
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border lg:hidden ${
            scrolled || open
              ? "border-[var(--line-strong)] text-[var(--ink)]"
              : "border-white/40 text-white"
          }`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t("nav.close") : t("nav.menu")}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--line)] bg-[rgba(247,248,250,0.98)] lg:hidden">
          <div className="wrap flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-3 text-[1rem] font-medium hover:bg-white"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="px-3 py-2">
              <LanguageSwitcher />
            </div>
            <Link
              href="/book"
              className="btn btn-primary mt-2"
              onClick={() => setOpen(false)}
            >
              {t("nav.bookCta")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

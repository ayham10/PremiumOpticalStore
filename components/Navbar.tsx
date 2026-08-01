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

  useEffect(() => {
    document.body.classList.toggle("has-mobile-nav-open", open);
    return () => document.body.classList.remove("has-mobile-nav-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-[var(--line)] bg-[rgba(247,248,250,0.94)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="wrap flex items-center justify-between gap-3 py-3 sm:gap-4 sm:py-4">
        <Link
          href="/"
          className={`font-[family-name:var(--font-display)] text-[1.4rem] tracking-[0.08em] sm:text-[1.55rem] ${
            scrolled || open ? "text-[var(--ink)]" : "text-white"
          }`}
          onClick={() => setOpen(false)}
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
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(8,12,18,0.45)] backdrop-blur-[2px]"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto flex h-[min(100%,calc(100svh-3.5rem))] w-full max-w-lg flex-col border-t border-[var(--line)] bg-[rgba(247,248,250,0.98)] shadow-2xl">
            <div className="wrap flex flex-1 flex-col gap-1 overflow-y-auto py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-2xl px-4 py-3.5 text-[1.05rem] font-medium text-[var(--ink)] transition hover:bg-white"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 px-4 py-3">
                <LanguageSwitcher />
              </div>
              <Link
                href="/admin"
                className="rounded-2xl px-4 py-3 text-sm font-medium text-[var(--slate)]"
                onClick={() => setOpen(false)}
              >
                {t("nav.admin")}
              </Link>
              <Link
                href="/book"
                className="btn btn-primary mt-3 w-full"
                onClick={() => setOpen(false)}
              >
                {t("nav.bookCta")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

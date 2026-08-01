"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function Navbar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isDarkPage = isHome || pathname === "/frames";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/services", label: t("nav.services") },
    { href: "/eye-exams", label: t("nav.exam") },
    { href: "/shop", label: t("nav.shop") },
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
    setOpen(false);
  }, [pathname]);

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

  const elevated = scrolled || open;
  const whiteText = isDarkPage || !elevated;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          elevated
            ? isDarkPage || open
              ? "border-b border-white/10 bg-[rgba(10,14,20,0.72)] backdrop-blur-2xl"
              : "border-b border-[var(--line)] bg-[rgba(247,248,250,0.94)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="wrap flex items-center justify-between gap-3 py-3 sm:gap-4 sm:py-4">
          <Link
            href="/"
            className={`font-[family-name:var(--font-display)] text-[1.35rem] tracking-[0.1em] sm:text-[1.5rem] ${
              whiteText || open ? "text-white" : "text-[var(--ink)]"
            }`}
            onClick={() => setOpen(false)}
          >
            LUM
            <span style={{ color: whiteText || open ? "#d4b483" : "var(--accent)" }}>I</span>
            NA
            <span
              className={`ms-1 hidden text-[0.62em] tracking-[0.18em] sm:inline ${
                whiteText || open ? "text-white/70" : "text-[var(--slate)]"
              }`}
            >
              OPTICAL
            </span>
          </Link>

          <nav
            className={`hidden items-center gap-5 text-[0.86rem] font-semibold uppercase tracking-[0.12em] xl:flex ${
              whiteText ? "text-white/80" : "text-[var(--slate)]"
            }`}
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-[var(--copper-soft)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher compact tone={whiteText ? "dark" : "light"} />
            <Link
              href="/book"
              className={`btn !min-h-11 !px-5 !text-sm ${
                whiteText ? "btn-copper" : "btn-primary"
              }`}
            >
              {t("nav.bookCta")}
            </Link>
          </div>

          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border lg:hidden ${
              whiteText || open
                ? "border-white/35 text-white"
                : "border-[var(--line-strong)] text-[var(--ink)]"
            }`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t("nav.close") : t("nav.menu")}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Premium mobile dropdown — not a full-screen drawer */}
        <AnimatePresence>
          {open ? (
            <motion.div
              className="lg:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="mobile-nav-panel">
                <nav className="wrap flex flex-col pb-5 pt-1">
                  {links.map((l, i) => (
                    <motion.div
                      key={l.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + i * 0.035, duration: 0.28 }}
                    >
                      <Link
                        href={l.href}
                        className="mobile-nav-link"
                        onClick={() => setOpen(false)}
                      >
                        {l.label}
                      </Link>
                    </motion.div>
                  ))}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-1 pt-4">
                    <LanguageSwitcher tone="dark" />
                    <Link
                      href="/book"
                      className="btn btn-copper !min-h-11 !px-5 !text-sm"
                      onClick={() => setOpen(false)}
                    >
                      {t("nav.bookCta")}
                    </Link>
                  </div>
                </nav>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            className="mobile-nav-scrim lg:hidden"
            aria-label={t("nav.close")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

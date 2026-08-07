"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  Eye,
  Glasses,
  Sun,
  Store,
  Info,
  Phone,
  MapPin,
  Clock,
  ShoppingBag,
  Percent,
} from "lucide-react";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  cachedJsonFetch,
  productsCacheKey,
  promotionsSlidesCacheKey,
} from "@/lib/public-data-cache";

const MAPS_URL = "https://maps.app.goo.gl/wjbQSBYvR2fCidLq8";

const MOBILE_LINKS = [
  { href: "/eye-exams", labelKey: "nav.exam", icon: Eye },
  { href: "/frames", labelKey: "nav.frames", icon: Glasses },
  { href: "/sunglasses", labelKey: "nav.sunglasses", icon: Sun },
  { href: "/shop", labelKey: "nav.shop", icon: Store },
  { href: "/about", labelKey: "nav.about", icon: Info },
  { href: "/promotions", labelKey: "home.gateway.promotions.title", icon: Percent },
] as const;

export default function Navbar() {
  const { t } = useLocale();
  const { branding, settings } = useBranding();
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isProduct = pathname?.startsWith("/product/") ?? false;
  const isEyeExam = pathname === "/eye-exams";
  const isAbout = pathname === "/about";
  const isCatalogue =
    pathname === "/frames" ||
    pathname === "/sunglasses" ||
    pathname === "/contact-lenses" ||
    pathname === "/shop" ||
    pathname === "/promotions";
  const isBook = pathname === "/book";
  const isSolidDark =
    isProduct || isEyeExam || isCatalogue || isBook || isAbout || isHome;
  const isDarkPage = isHome || isSolidDark;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const desktopLinks = MOBILE_LINKS;

  const phone = settings?.phone || t("eyeExam.info.whatsappValue");
  const hours = t("footer.hoursValue");
  const city = settings?.city || t("footer.city");
  const instagram = settings?.social?.instagram || "https://instagram.com";
  const whatsappRaw =
    settings?.whatsapp || settings?.phone || "972521234567";
  const whatsapp = String(whatsappRaw).replace(/[^\d]/g, "");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prefetch common public destinations + catalogue product data (SPA, no full reload)
  useEffect(() => {
    const routes = [
      "/frames",
      "/sunglasses",
      "/book",
      "/shop",
      "/eye-exams",
      "/promotions",
    ];
    for (const href of routes) {
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    }

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      void cachedJsonFetch(
        productsCacheKey(["Frames", "Prescription Glasses"]),
        "/api/products?category=Frames&category=Prescription%20Glasses",
      ).catch(() => undefined);
      void cachedJsonFetch(
        productsCacheKey(["Sunglasses"]),
        "/api/products?category=Sunglasses",
      ).catch(() => undefined);
      void cachedJsonFetch(
        promotionsSlidesCacheKey(),
        "/api/promotions?slides=1",
      ).catch(() => undefined);
    };

    let idleId: number | null = null;
    let timeoutId: number | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(warm, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(warm, 400);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [router]);

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

  const elevated = scrolled || open || isSolidDark;
  const whiteText = isDarkPage || !elevated;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isSolidDark
            ? "border-b border-white/10 bg-[rgba(11,13,16,0.92)] backdrop-blur-xl"
            : elevated
              ? isDarkPage || open
                ? "border-b border-white/10 bg-[rgba(10,14,20,0.72)] backdrop-blur-2xl"
                : "border-b border-[var(--line)] bg-[rgba(247,248,250,0.94)] backdrop-blur-xl"
              : "border-b border-transparent bg-transparent"
        }`}
      >
        <div
          className={`wrap py-3 sm:py-3.5 ${
            isCatalogue
              ? "oyon-nav-bar oyon-nav-bar--catalogue"
              : "flex items-center justify-between gap-3 sm:gap-4"
          }`}
        >
          {isCatalogue ? (
            <>
              <div className="oyon-nav-side oyon-nav-side--start">
                <button
                  type="button"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
                    whiteText || open
                      ? "border-[rgba(212,175,106,0.55)] text-[#e6c58a]"
                      : "border-[var(--line-strong)] text-[var(--ink)]"
                  } xl:hidden`}
                  onClick={() => setOpen((v) => !v)}
                  aria-label={open ? t("nav.close") : t("nav.menu")}
                  aria-expanded={open}
                >
                  {open ? <X size={18} /> : <Menu size={18} />}
                </button>
                <nav
                  className={`hidden items-center gap-4 text-[0.78rem] font-semibold uppercase tracking-[0.12em] xl:flex ${
                    whiteText ? "text-white/80" : "text-[var(--slate)]"
                  }`}
                >
                  {desktopLinks.slice(0, 3).map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="transition-colors hover:text-[var(--copper-soft)]"
                    >
                      {t(l.labelKey)}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="oyon-nav-center">
                <BrandMark
                  branding={branding}
                  href="/"
                  onDark={whiteText || open}
                  size="sm"
                  onClick={() => setOpen(false)}
                />
              </div>

              <div className="oyon-nav-side oyon-nav-side--end">
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
                <Link
                  href="/shop"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border lg:hidden ${
                    whiteText || open
                      ? "border-[rgba(212,175,106,0.55)] text-[#e6c58a]"
                      : "border-[var(--line-strong)] text-[var(--ink)]"
                  }`}
                  aria-label={t("nav.shop")}
                >
                  <ShoppingBag size={17} strokeWidth={1.6} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <BrandMark
                branding={branding}
                href="/"
                onDark={whiteText || open}
                size="sm"
                onClick={() => setOpen(false)}
              />

              <nav
                className={`hidden items-center gap-5 text-[0.82rem] font-semibold uppercase tracking-[0.12em] xl:flex ${
                  whiteText ? "text-white/80" : "text-[var(--slate)]"
                }`}
              >
                {desktopLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="transition-colors hover:text-[var(--copper-soft)]"
                  >
                    {t(l.labelKey)}
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
                    ? "border-[rgba(212,175,106,0.55)] text-[#e6c58a]"
                    : "border-[var(--line-strong)] text-[var(--ink)]"
                }`}
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? t("nav.close") : t("nav.menu")}
                aria-expanded={open}
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </>
          )}
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="oyon-mobile-menu lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="oyon-mobile-menu-top">
              <BrandMark
                branding={branding}
                href="/"
                size="lg"
                onDark
                onClick={() => setOpen(false)}
              />
              <button
                type="button"
                className="oyon-mobile-close"
                onClick={() => setOpen(false)}
                aria-label={t("nav.close")}
              >
                <X size={18} />
              </button>
            </div>

            <nav className="oyon-mobile-nav" aria-label={t("nav.menu")}>
              {MOBILE_LINKS.map((l, i) => {
                const Icon = l.icon;
                const active = pathname === l.href;
                return (
                  <motion.div
                    key={l.href}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.03, duration: 0.28 }}
                  >
                    <Link
                      href={l.href}
                      className={`oyon-mobile-link${active ? " is-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="oyon-mobile-link-icon" aria-hidden>
                        <Icon size={20} strokeWidth={1.5} />
                      </span>
                      <span>{t(l.labelKey)}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="oyon-mobile-bottom">
              <div className="oyon-mobile-lang">
                <LanguageSwitcher tone="dark" />
              </div>

              <Link
                href="/book"
                className="btn btn-copper oyon-mobile-book"
                onClick={() => setOpen(false)}
              >
                {t("nav.bookCta")}
              </Link>

              <div className="oyon-mobile-meta">
                <p>
                  <MapPin size={14} aria-hidden />
                  <span>{city}</span>
                </p>
                <p>
                  <Clock size={14} aria-hidden />
                  <span dir="ltr">{hours}</span>
                </p>
                <p>
                  <Phone size={14} aria-hidden />
                  <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr">
                    {phone}
                  </a>
                </p>
              </div>

              <div className="oyon-mobile-social">
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="oyon-mobile-social-btn"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="oyon-mobile-social-btn"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                    <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9 9 0 1 1 12 20.5zm4.9-6.7c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z" />
                  </svg>
                </a>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("footer.maps")}
                  className="oyon-mobile-social-btn"
                >
                  <MapPin size={18} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

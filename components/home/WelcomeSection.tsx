"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import OyonLogo from "@/components/branding/OyonLogo";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { StoreSettings } from "@/lib/types";

function HeroSubtitle({ text }: { text: string }) {
  const parts = text.split(/\s*•\s*/).filter(Boolean);
  return (
    <p className="home-welcome-line">
      {parts.map((part, i) => (
        <Fragment key={`${part}-${i}`}>
          {i > 0 ? (
            <span className="home-welcome-line-sep" aria-hidden>
              •
            </span>
          ) : null}
          <span className="home-welcome-line-item">{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

export default function WelcomeSection() {
  const { t, locale } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [content, setContent] = useState<StoreSettings["content"]>();
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { settings?: StoreSettings }) => {
        if (!cancelled) setContent(data.settings?.content);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;

    const onCanPlay = () => {
      if (cancelled) return;
      setVideoReady(true);
      void video.play().catch(() => undefined);
    };

    const start = () => {
      if (cancelled) return;
      if (!video.getAttribute("src")) {
        video.src = "/videos/welcome-loop.mp4";
        video.load();
      }
      void video.play().catch(() => undefined);
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", () => setVideoReady(true));

    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    let idleId: number | undefined;
    let timerId: number | undefined;
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 200 });
    } else {
      timerId = window.setTimeout(start, 40);
    }

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", onCanPlay);
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, []);

  function scrollToHome() {
    document.getElementById("home-hub")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const heroTitle = content?.heroTitle?.[locale]?.trim() || t("hero.title");
  // Approved hero subtitle copy (ignore CMS override so spacing/text stay consistent)
  const welcomeLine = t("home.welcomeLine");

  return (
    <section className="home-welcome" aria-label="Welcome">
      <video
        ref={videoRef}
        className={`home-welcome-video${videoReady ? " is-ready" : ""}`}
        poster="/videos/welcome-poster.jpg"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      />
      <div className="home-welcome-overlay" aria-hidden />

      <div className="home-welcome-content">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-brand"
        >
          <OyonLogo link={false} size="lg" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-title"
        >
          {heroTitle}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroSubtitle text={welcomeLine} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-cta-wrap"
          dir="ltr"
        >
          <Link href="/book" className="home-welcome-cta home-welcome-cta--primary">
            <span>{t("home.bookAppointment")}</span>
            <CalendarDays size={17} aria-hidden />
          </Link>
          <Link href="/shop" className="home-welcome-cta home-welcome-cta--secondary">
            <span>{t("home.shopNow")}</span>
            <ShoppingBag size={17} aria-hidden />
          </Link>
        </motion.div>
      </div>

      <button
        type="button"
        className="home-welcome-scroll"
        onClick={scrollToHome}
        aria-label={t("home.scrollHint")}
      >
        <span className="home-welcome-glasses-wrap" aria-hidden>
          <svg
            className="home-welcome-waveform"
            viewBox="0 0 200 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="3" y1="12" x2="3" y2="12" />
              <line x1="8" y1="9" x2="8" y2="15" />
              <line x1="13" y1="6.5" x2="13" y2="17.5" />
              <line x1="18" y1="10" x2="18" y2="14" />
              <line x1="23" y1="5" x2="23" y2="19" />
              <line x1="28" y1="8" x2="28" y2="16" />
              <line x1="33" y1="6" x2="33" y2="18" />
              <line x1="38" y1="9.5" x2="38" y2="14.5" />
              <line x1="43" y1="4" x2="43" y2="20" />
              <line x1="48" y1="7.5" x2="48" y2="16.5" />
              <line x1="53" y1="6" x2="53" y2="18" />
              <line x1="58" y1="10" x2="58" y2="14" />
              <line x1="63" y1="8" x2="63" y2="16" />
              <line x1="68" y1="10.5" x2="68" y2="13.5" />
              <line x1="132" y1="10.5" x2="132" y2="13.5" />
              <line x1="137" y1="8" x2="137" y2="16" />
              <line x1="142" y1="10" x2="142" y2="14" />
              <line x1="147" y1="6" x2="147" y2="18" />
              <line x1="152" y1="7.5" x2="152" y2="16.5" />
              <line x1="157" y1="4" x2="157" y2="20" />
              <line x1="162" y1="9.5" x2="162" y2="14.5" />
              <line x1="167" y1="6" x2="167" y2="18" />
              <line x1="172" y1="8" x2="172" y2="16" />
              <line x1="177" y1="5" x2="177" y2="19" />
              <line x1="182" y1="10" x2="182" y2="14" />
              <line x1="187" y1="6.5" x2="187" y2="17.5" />
              <line x1="192" y1="9" x2="192" y2="15" />
              <line x1="197" y1="12" x2="197" y2="12" />
            </g>
          </svg>
          <span className="home-welcome-glasses">
            <svg
              viewBox="0 0 64 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="home-welcome-glasses-icon"
            >
              <circle cx="16" cy="14" r="11" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="48" cy="14" r="11" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M27 14h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M5 14H1.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M59 14h3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>
        <ChevronDown size={16} className="home-welcome-explore-chevron" aria-hidden />
      </button>
    </section>
  );
}

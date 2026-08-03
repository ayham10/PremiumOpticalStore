"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import OyonLogo from "@/components/branding/OyonLogo";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { StoreSettings } from "@/lib/types";

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
  const welcomeLine =
    content?.heroLine?.[locale]?.trim() || t("home.welcomeLine");

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

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-line"
        >
          {welcomeLine}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-cta-wrap"
        >
          <Link href="/book" className="btn btn-copper home-welcome-cta">
            <CalendarDays size={18} aria-hidden />
            {t("home.bookAppointment")}
          </Link>
        </motion.div>
      </div>

      <button
        type="button"
        className="home-welcome-scroll"
        onClick={scrollToHome}
        aria-label={t("home.scrollHint")}
      >
        <span className="home-welcome-explore-pill" aria-hidden>
          <span className="home-welcome-explore-dot" />
        </span>
        <span className="home-welcome-scroll-label">{t("home.scrollHint")}</span>
        <ChevronDown size={16} className="home-welcome-explore-chevron" aria-hidden />
      </button>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function WelcomeSection() {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Lazy start after paint for faster first contentful paint
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      if (!video.getAttribute("src")) {
        video.src = "/videos/welcome.mp4";
        video.load();
      }
      void video.play().catch(() => {
        /* autoplay may be blocked */
      });
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    let idleId: number | undefined;
    let timerId: number | undefined;
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 900 });
    } else {
      timerId = window.setTimeout(start, 250);
    }

    return () => {
      cancelled = true;
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

  return (
    <section className="home-welcome" aria-label="Welcome">
      <video
        ref={videoRef}
        className="home-welcome-video"
        poster="/videos/welcome-poster.jpg"
        muted
        loop
        playsInline
        preload="none"
      />
      <div className="home-welcome-overlay" aria-hidden />

      <div className="home-welcome-content">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-brand"
        >
          LUM<span style={{ color: "#d4b483" }}>I</span>NA{" "}
          <span className="home-welcome-brand-soft">OPTICAL</span>
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-title"
        >
          {t("hero.title")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-line"
        >
          {t("home.welcomeLine")}
        </motion.p>
      </div>

      <button
        type="button"
        className="home-welcome-scroll"
        onClick={scrollToHome}
        aria-label={t("home.scrollHint")}
      >
        <span className="home-welcome-mouse" aria-hidden>
          <span className="home-welcome-mouse-wheel" />
        </span>
        <span className="home-welcome-scroll-label">{t("home.scrollHint")}</span>
      </button>
    </section>
  );
}

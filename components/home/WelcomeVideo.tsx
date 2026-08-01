"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function WelcomeVideo() {
  const { t } = useLocale();

  function scrollToNav() {
    const el = document.getElementById("home-nav");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="home-welcome" aria-label="Welcome">
      <video
        className="home-welcome-video"
        src="/videos/hero.mp4"
        poster="https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1600&q=80"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="home-welcome-overlay" aria-hidden />

      <div className="home-welcome-content">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-brand"
        >
          LUM<span style={{ color: "#d4b483" }}>I</span>NA{" "}
          <span className="home-welcome-brand-soft">OPTICAL</span>
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-title"
        >
          {t("hero.title")}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="home-welcome-lines"
        >
          <p>{t("hero.line1").replace(/\.$/, "")}</p>
          <p>{t("hero.line2").replace(/\.$/, "")}</p>
          <p>
            {t("hero.line3").replace(/\.$/, "")} {t("hero.line4").replace(/\.$/, "")}
          </p>
        </motion.div>
      </div>

      <button
        type="button"
        className="home-welcome-scroll"
        onClick={scrollToNav}
        aria-label={t("home.scrollHint")}
      >
        <span className="home-welcome-scroll-label">{t("home.scrollHint")}</span>
        <span className="home-welcome-mouse" aria-hidden>
          <span className="home-welcome-mouse-wheel" />
        </span>
      </button>
    </section>
  );
}

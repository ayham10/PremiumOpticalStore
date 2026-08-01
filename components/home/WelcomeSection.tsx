"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function WelcomeSection() {
  const { t } = useLocale();

  function scrollToHome() {
    document.getElementById("home-hub")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="home-welcome" aria-label="Welcome">
      <video
        className="home-welcome-video"
        src="/videos/welcome.mp4"
        poster="/videos/welcome-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
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

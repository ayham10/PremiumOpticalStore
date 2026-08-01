"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function HomeHero() {
  const { t } = useLocale();

  return (
    <section className="relative min-h-[100svh] overflow-hidden text-white">
      <video
        className="hero-video"
        src="/videos/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1600&q=80"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,12,18,0.55) 0%, rgba(8,12,18,0.28) 42%, rgba(8,12,18,0.78) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
        <div className="wrap max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-[clamp(2.8rem,9vw,5.5rem)] leading-[0.95] tracking-[0.04em]"
          >
            LUM<span style={{ color: "#9ec9e6" }}>I</span>NA
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2rem,5.5vw,3.6rem)] font-normal text-white"
          >
            {t("hero.title")}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 space-y-1 text-[clamp(1.05rem,2.2vw,1.35rem)] text-white/85"
          >
            <p>{t("hero.line1")}</p>
            <p>{t("hero.line2")}</p>
            <p>{t("hero.line3")}</p>
            <p>{t("hero.line4")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/book" className="btn btn-primary">
              {t("hero.ctaBook")}
            </Link>
            <Link href="/shop" className="btn btn-glass">
              {t("hero.ctaShop")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

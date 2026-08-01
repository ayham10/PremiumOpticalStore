"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

const SESSION_KEY = "lumina-intro-shown";
const TOTAL_MS = 3600;

function markIntroSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function IntroLoader() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  const opticalLabel = t("intro.optical");
  const tagline = t("intro.tagline");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    setVisible(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = window.setTimeout(() => {
        markIntroSeen();
        setVisible(false);
      }, 400);
      return () => window.clearTimeout(id);
    }

    const timers = [
      window.setTimeout(() => setPhase(1), 200),
      window.setTimeout(() => setPhase(2), 900),
      window.setTimeout(() => setPhase(3), 1700),
      window.setTimeout(() => setPhase(4), 2500),
      window.setTimeout(() => {
        markIntroSeen();
        setVisible(false);
      }, TOTAL_MS),
    ];

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[5000] flex items-center justify-center overflow-hidden bg-[#050608]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{
              background:
                phase >= 1
                  ? "radial-gradient(circle at 50% 48%, rgba(198,161,91,0.22), transparent 42%)"
                  : "radial-gradient(circle at 50% 48%, rgba(198,161,91,0.0), transparent 42%)",
            }}
            transition={{ duration: 1.1 }}
          />

          <motion.div
            className="absolute"
            initial={{ scale: 0, opacity: 0 }}
            animate={
              phase === 0
                ? { scale: 0, opacity: 0 }
                : phase === 1
                  ? { scale: 1, opacity: 1 }
                  : phase >= 2
                    ? { scale: 1.15, opacity: phase >= 4 ? 0.35 : 0.9 }
                    : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="relative h-[min(42vw,220px)] w-[min(42vw,220px)] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #f3e2b0 0%, #c6a15b 28%, #6d5224 62%, #1a140a 100%)",
                boxShadow:
                  "0 0 60px rgba(198,161,91,0.45), inset 0 0 40px rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="absolute inset-[18%] rounded-full border border-[rgba(255,240,200,0.35)]"
                style={{
                  background:
                    "conic-gradient(from 210deg, rgba(255,255,255,0.12), transparent 30%, rgba(198,161,91,0.35), transparent 70%, rgba(255,255,255,0.1))",
                }}
              />
              <motion.div
                className="absolute inset-[34%] rounded-full bg-[#0a0c10]"
                animate={{ scale: phase >= 2 ? 0.92 : 1 }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </motion.div>

          <motion.svg
            viewBox="0 0 320 120"
            className="absolute h-auto w-[min(78vw,420px)]"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={
              phase >= 3
                ? { opacity: phase >= 4 ? 0.25 : 1, y: 0, scale: 1 }
                : { opacity: 0, y: 12, scale: 0.96 }
            }
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <defs>
              <linearGradient id="lensShine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="45%" stopColor="rgba(198,161,91,0.15)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="#e7d3a0" strokeWidth="3.2" strokeLinecap="round">
              <rect x="28" y="28" width="96" height="64" rx="30" />
              <rect x="196" y="28" width="96" height="64" rx="30" />
              <path d="M124 60h72" />
              <path d="M28 58H12" />
              <path d="M292 58h16" />
            </g>
            <rect x="34" y="34" width="84" height="52" rx="26" fill="url(#lensShine)" opacity="0.55" />
            <rect x="202" y="34" width="84" height="52" rx="26" fill="url(#lensShine)" opacity="0.55" />
            <motion.rect
              x="34"
              y="34"
              width="84"
              height="52"
              rx="26"
              fill="rgba(255,255,255,0.18)"
              animate={{ x: phase >= 3 ? [34, 70, 34] : 34, opacity: [0, 0.35, 0] }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          </motion.svg>

          <motion.div
            className="relative z-10 px-6 text-center text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,8vw,4.2rem)] tracking-[0.18em]">
              LUM<span style={{ color: "#e3c789" }}>I</span>NA
            </div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.42em] text-amber-200">
              {opticalLabel}
            </div>
            <p className="mt-5 font-[family-name:var(--font-display)] text-[clamp(1.2rem,3.5vw,1.7rem)] text-white/90">
              {tagline}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

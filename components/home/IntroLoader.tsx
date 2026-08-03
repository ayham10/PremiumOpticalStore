"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import OyonLogo from "@/components/branding/OyonLogo";

const SESSION_KEY = "oyon-intro-shown";
/** ~2s splash then smooth fade into homepage */
const TOTAL_MS = 2000;

function markIntroSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function IntroLoader() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);

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
      }, 280);
      return () => window.clearTimeout(id);
    }

    const timers = [
      window.setTimeout(() => setPhase(1), 80),
      window.setTimeout(() => setPhase(2), 320),
      window.setTimeout(() => setPhase(3), 700),
      window.setTimeout(() => setPhase(4), 1200),
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
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{
              background:
                phase >= 1
                  ? "radial-gradient(circle at 50% 48%, rgba(212,180,131,0.22), transparent 42%)"
                  : "radial-gradient(circle at 50% 48%, rgba(212,180,131,0), transparent 42%)",
            }}
            transition={{ duration: 0.7 }}
          />

          <motion.svg
            viewBox="0 0 320 120"
            className="absolute h-auto w-[min(68vw,340px)]"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={
              phase >= 2
                ? { opacity: phase >= 4 ? 0.14 : 0.9, y: 0, scale: 1 }
                : { opacity: 0, y: 10, scale: 0.97 }
            }
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <g fill="none" stroke="#e7d3a0" strokeWidth="3.2" strokeLinecap="round">
              <rect x="28" y="28" width="96" height="64" rx="30" />
              <rect x="196" y="28" width="96" height="64" rx="30" />
              <path d="M124 60h72" />
              <path d="M28 58H12" />
              <path d="M292 58h16" />
            </g>
          </motion.svg>

          <motion.div
            className="relative z-10 px-6 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <OyonLogo link={false} size="xl" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

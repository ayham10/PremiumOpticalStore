"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/components/i18n/LocaleProvider";
import EyeExamBookingModal from "@/components/eye-exam/EyeExamBookingModal";

export default function EyeExamPage() {
  const { t, rtl } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
      return;
    }
    video.muted = true;
    const play = video.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* autoplay may be blocked; poster remains visible */
      });
    }
  }, [reducedMotion]);

  return (
    <div className="eye-exam-page" dir={rtl ? "rtl" : "ltr"}>
      <div className="eye-exam-inner wrap">
        <section className="eye-exam-hero" aria-label={t("eyeExam.title")}>
          <div className="eye-exam-video-frame">
            {reducedMotion ? (
              <Image
                src="/images/eye-exam-poster.jpg"
                alt={t("eyeExam.videoAlt")}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 960px"
              />
            ) : (
              <video
                ref={videoRef}
                className="eye-exam-video"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/images/eye-exam-poster.jpg"
                aria-label={t("eyeExam.videoAlt")}
              >
                <source src="/videos/eye-exam.mp4" type="video/mp4" />
              </video>
            )}
            <div className="eye-exam-video-veil" aria-hidden />
          </div>
        </section>

        <section className="eye-exam-content">
          <p className="eye-exam-eyebrow">{t("eyeExam.eyebrow")}</p>
          <h1 className="eye-exam-title">{t("eyeExam.title")}</h1>
          <p className="eye-exam-description">{t("eyeExam.description")}</p>
          <div className="eye-exam-actions">
            <button
              type="button"
              className="btn btn-copper eye-exam-btn"
              onClick={() => setBookingOpen(true)}
            >
              {t("eyeExam.bookCta")}
            </button>
            <Link href="/services" className="btn eye-exam-btn eye-exam-btn-secondary">
              {t("eyeExam.servicesCta")}
            </Link>
          </div>
        </section>
      </div>

      <EyeExamBookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
}

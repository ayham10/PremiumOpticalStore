"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircle,
  Microscope,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import EyeExamHeroVideo from "@/components/eye-exam/EyeExamHeroVideo";

type NextSlot = {
  available: boolean;
  date?: string;
  time?: string;
  label?: string;
  weekday?: number;
  displayDate?: string;
};

type PublicSettings = {
  address?: string;
  city?: string;
  whatsapp?: string;
  phone?: string;
};

function formatWhatsAppDisplay(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 12) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 3)}-${local.slice(3)}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return raw;
}

export default function EyeExamPage() {
  const { t, rtl } = useLocale();
  const [nextSlot, setNextSlot] = useState<NextSlot | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/eye-exam/next-available")
      .then((res) => res.json())
      .then((data: NextSlot) => {
        if (alive) setNextSlot(data);
      })
      .catch(() => {
        if (alive) setNextSlot({ available: false });
      });

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (alive) setSettings(data.settings || null);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const weekdayLabel =
    typeof nextSlot?.weekday === "number"
      ? t(`eyeExam.weekdays.${nextSlot.weekday}`)
      : "";

  const whatsappDisplay =
    formatWhatsAppDisplay(settings?.whatsapp) ||
    formatWhatsAppDisplay(settings?.phone) ||
    t("eyeExam.info.whatsappValue");

  const whatsappHref = `https://wa.me/${(settings?.whatsapp || "9725550180").replace(/\D/g, "")}`;

  const locationLine1 = t("eyeExam.info.locationCity");
  const locationLine2 = t("eyeExam.info.locationStreet");

  return (
    <div className="eye-exam-page" dir={rtl ? "rtl" : "ltr"}>
      <div className="eye-exam-inner">
        <section className="eye-exam-hero" aria-label={t("eyeExam.title")}>
          <EyeExamHeroVideo alt={t("eyeExam.videoAlt")} />
        </section>

        <section className="eye-exam-content">
          <p className="eye-exam-eyebrow">{t("eyeExam.eyebrow")}</p>
          <h1 className="eye-exam-title">{t("eyeExam.title")}</h1>
          <p className="eye-exam-description">{t("eyeExam.description")}</p>

          <div className="eye-exam-actions">
            <Link
              href="/book?type=eye_exam"
              className="btn btn-copper eye-exam-btn"
            >
              {t("eyeExam.bookCta")}
            </Link>
            <Link href="/services" className="btn eye-exam-btn eye-exam-btn-secondary">
              {t("eyeExam.servicesCta")}
            </Link>
          </div>
        </section>

        <section className="eye-exam-trust" aria-label={t("eyeExam.trust.aria")}>
          <div className="eye-exam-trust-grid">
            <article className="eye-exam-trust-item">
              <UserRound className="eye-exam-trust-icon" aria-hidden size={22} strokeWidth={1.6} />
              <p>{t("eyeExam.trust.professional")}</p>
            </article>
            <article className="eye-exam-trust-item">
              <Microscope className="eye-exam-trust-icon" aria-hidden size={22} strokeWidth={1.6} />
              <p>{t("eyeExam.trust.equipment")}</p>
            </article>
            <article className="eye-exam-trust-item">
              <Zap className="eye-exam-trust-icon" aria-hidden size={22} strokeWidth={1.6} />
              <p>{t("eyeExam.trust.booking")}</p>
            </article>
          </div>
        </section>

        <p className="eye-exam-blurb">{t("eyeExam.blurb")}</p>

        <section className="eye-exam-next-card">
          <div className="eye-exam-next-top">
            <CalendarDays className="eye-exam-next-icon" aria-hidden size={28} strokeWidth={1.5} />
            <div>
              <p className="eye-exam-next-label">{t("eyeExam.next.label")}</p>
              {nextSlot?.available && nextSlot.time ? (
                <p className="eye-exam-next-value">
                  <span>{weekdayLabel}</span>
                  <span className="eye-exam-next-sep"> </span>
                  <span>{nextSlot.displayDate || nextSlot.label}</span>
                  <span className="eye-exam-next-sep"> — </span>
                  <span>{nextSlot.time}</span>
                </p>
              ) : (
                <p className="eye-exam-next-empty">
                  {nextSlot === null ? t("common.loading") : t("eyeExam.next.empty")}
                </p>
              )}
            </div>
          </div>
          <Link href="/book?type=eye_exam" className="eye-exam-next-btn">
            {t("eyeExam.next.cta")}
          </Link>
        </section>

        <section className="eye-exam-info-card" aria-label={t("eyeExam.info.aria")}>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="eye-exam-info-col"
          >
            <MessageCircle className="eye-exam-info-icon" aria-hidden size={20} strokeWidth={1.6} />
            <p className="eye-exam-info-label">{t("eyeExam.info.whatsapp")}</p>
            <p className="eye-exam-info-value" dir="ltr">
              {whatsappDisplay}
            </p>
          </a>
          <div className="eye-exam-info-col" aria-hidden={false}>
            <Clock3 className="eye-exam-info-icon" aria-hidden size={20} strokeWidth={1.6} />
            <p className="eye-exam-info-label">{t("eyeExam.info.hours")}</p>
            <p className="eye-exam-info-value">{t("eyeExam.info.hoursValue")}</p>
            <p className="eye-exam-info-sub">{t("eyeExam.info.hoursNote")}</p>
          </div>
          <div className="eye-exam-info-col">
            <MapPin className="eye-exam-info-icon" aria-hidden size={20} strokeWidth={1.6} />
            <p className="eye-exam-info-label">{t("eyeExam.info.location")}</p>
            <p className="eye-exam-info-value">{locationLine1}</p>
            <p className="eye-exam-info-sub">{locationLine2}</p>
          </div>
        </section>

        <p className="eye-exam-privacy">
          <ShieldCheck size={14} aria-hidden strokeWidth={1.7} />
          <span>{t("eyeExam.privacy")}</span>
        </p>
      </div>

    </div>
  );
}

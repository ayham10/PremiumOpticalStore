"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  Clock3,
  Eye,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import EyeExamHeroVideo from "@/components/eye-exam/EyeExamHeroVideo";

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

const FEATURES = [
  { key: "specialists", Icon: UserRound },
  { key: "duration", Icon: Clock3 },
  { key: "equipment", Icon: ShieldCheck },
  { key: "comprehensive", Icon: Eye },
] as const;

const VALUES = [
  { key: "precision", Icon: Target },
  { key: "quality", Icon: Award },
  { key: "care", Icon: Heart },
] as const;

const BADGES = [
  { key: "specialists", Icon: Award },
  { key: "privacy", Icon: Lock },
  { key: "accuracy", Icon: Check },
] as const;

export default function EyeExamPage() {
  const { t, rtl, dict } = useLocale();
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let alive = true;
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

  const whatsappDisplay =
    formatWhatsAppDisplay(settings?.whatsapp) ||
    formatWhatsAppDisplay(settings?.phone) ||
    t("eyeExam.info.whatsappValue");

  const whatsappHref = `https://wa.me/${(settings?.whatsapp || "9725550180").replace(/\D/g, "")}`;

  const benefits = dict.eyeExam.benefits.items;

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
          </div>
        </section>

        <section className="eye-exam-features" aria-label={t("eyeExam.features.aria")}>
          <div className="eye-exam-features-grid">
            {FEATURES.map(({ key, Icon }) => (
              <article key={key} className="eye-exam-feature-card">
                <Icon className="eye-exam-feature-icon" aria-hidden size={20} strokeWidth={1.6} />
                <p>{t(`eyeExam.features.${key}`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="eye-exam-benefits" aria-labelledby="eye-exam-benefits-title">
          <h2 id="eye-exam-benefits-title" className="eye-exam-benefits-title">
            {t("eyeExam.benefits.title")}
          </h2>
          <ul className="eye-exam-benefits-list">
            {benefits.map((item) => (
              <li key={item}>
                <Check className="eye-exam-benefits-check" aria-hidden size={16} strokeWidth={2.2} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="eye-exam-values" aria-label={t("eyeExam.values.aria")}>
          <div className="eye-exam-values-grid">
            {VALUES.map(({ key, Icon }) => (
              <article key={key} className="eye-exam-value-card">
                <Icon className="eye-exam-value-icon" aria-hidden size={22} strokeWidth={1.6} />
                <p>{t(`eyeExam.values.${key}`)}</p>
              </article>
            ))}
          </div>
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
          <div className="eye-exam-info-col">
            <Clock3 className="eye-exam-info-icon" aria-hidden size={20} strokeWidth={1.6} />
            <p className="eye-exam-info-label">{t("eyeExam.info.hours")}</p>
            <p className="eye-exam-info-value">{t("eyeExam.info.hoursValue")}</p>
            <p className="eye-exam-info-sub">{t("eyeExam.info.hoursNote")}</p>
          </div>
          <div className="eye-exam-info-col">
            <MapPin className="eye-exam-info-icon" aria-hidden size={20} strokeWidth={1.6} />
            <p className="eye-exam-info-label">{t("eyeExam.info.location")}</p>
            <p className="eye-exam-info-value">{t("eyeExam.info.locationCity")}</p>
            <p className="eye-exam-info-sub">{t("eyeExam.info.locationStreet")}</p>
          </div>
        </section>

        <section className="eye-exam-badges" aria-label={t("eyeExam.badges.aria")}>
          {BADGES.map(({ key, Icon }) => (
            <div key={key} className="eye-exam-badge">
              <Icon size={14} strokeWidth={1.7} aria-hidden />
              <span>{t(`eyeExam.badges.${key}`)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Check, Lock, Target } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import EyeExamHeroVideo from "@/components/eye-exam/EyeExamHeroVideo";
import {
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  resolveServiceFeatureIcon,
} from "@/lib/service-page-icons";
import {
  pickServiceBenefits,
  pickServiceFeatures,
  pickServiceText,
} from "@/lib/service-pages";
import { useLocalizedServicePages } from "@/lib/use-service-pages";

const FEATURES = [
  { key: "specialists" },
  { key: "duration" },
  { key: "equipment" },
  { key: "comprehensive" },
] as const;

export default function EyeExamPage() {
  const { t, rtl, dict } = useLocale();
  const saved = useLocalizedServicePages()?.eyeExam;
  const title = pickServiceText(saved?.title, t("eyeExam.title"));
  const features = pickServiceFeatures(
    saved?.features,
    FEATURES.map(({ key }) => ({
      title: t(`eyeExam.features.${key}`),
      description: t(`eyeExam.features.${key}Lead`),
    })),
  );
  const benefits = pickServiceBenefits(
    saved?.benefits,
    dict.eyeExam.benefits.items,
  );

  return (
    <div className="eye-exam-page" dir={rtl ? "rtl" : "ltr"}>
      <section className="eye-exam-hero" aria-label={title}>
        <div className="eye-exam-hero-media">
          <EyeExamHeroVideo alt={t("eyeExam.videoAlt")} />
        </div>
        <div className="eye-exam-hero-copy">
          <p className="eye-exam-eyebrow">
            {pickServiceText(saved?.eyebrow, t("eyeExam.eyebrow"))}
          </p>
          <h1 className="eye-exam-title">{title}</h1>
          <p className="eye-exam-description">
            {pickServiceText(saved?.description, t("eyeExam.description"))}
          </p>
          <div className="eye-exam-actions">
            <Link
              href="/book?type=eye_exam"
              className="btn btn-copper eye-exam-btn"
            >
              {pickServiceText(saved?.bookingButtonText, t("eyeExam.bookCta"))}
            </Link>
          </div>
        </div>
      </section>

      <div className="eye-exam-inner">
        <section
          className="eye-exam-features"
          aria-label={t("eyeExam.features.aria")}
        >
          <div className="eye-exam-features-grid">
            {FEATURES.map(({ key }, index) => {
              const Icon = resolveServiceFeatureIcon(
                features[index]?.icon,
                EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ?? "eye",
              );
              return (
                <article key={key} className="eye-exam-feature">
                  <span className="eye-exam-feature-orb" aria-hidden>
                    <Icon size={22} strokeWidth={1.85} />
                  </span>
                  <div className="eye-exam-feature-copy">
                    <p className="eye-exam-feature-title">
                      {features[index]?.title}
                    </p>
                    <p className="eye-exam-feature-lead">
                      {features[index]?.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="eye-exam-benefits"
          aria-labelledby="eye-exam-benefits-title"
        >
          <h2 id="eye-exam-benefits-title" className="eye-exam-benefits-title">
            <span>
              {pickServiceText(saved?.benefitsTitle, t("eyeExam.benefits.title"))}
            </span>
            <span className="eye-exam-benefits-rule" aria-hidden />
          </h2>
          <ul className="eye-exam-benefits-list">
            {benefits.map((item) => (
              <li key={item}>
                <span className="eye-exam-check-orb" aria-hidden>
                  <Check size={13} strokeWidth={2.4} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="eye-exam-accuracy"
          aria-labelledby="eye-exam-accuracy-title"
        >
          <span className="eye-exam-accuracy-orb" aria-hidden>
            <Target size={16} strokeWidth={1.7} />
          </span>
          <h2 id="eye-exam-accuracy-title" className="eye-exam-accuracy-title">
            {t("eyeExam.values.precision")}
          </h2>
          <p className="eye-exam-accuracy-text">{t("eyeExam.values.quality")}</p>
        </section>

        <p className="eye-exam-privacy">
          <Lock size={14} aria-hidden strokeWidth={1.7} />
          <span>{t("eyeExam.privacy")}</span>
        </p>
      </div>
    </div>
  );
}

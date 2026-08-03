import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Crosshair,
  Gem,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About — OYON",
  description:
    "OYON is a premium optical boutique — authentic brands, advanced eye testing, and personal guidance.",
};

const FEATURES = [
  { key: "precision", icon: Crosshair },
  { key: "quality", icon: Gem },
  { key: "selection", icon: Sparkles },
  { key: "service", icon: HeartHandshake },
] as const;

export default async function AboutPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="about-page">
      <section className="about-hero" aria-label={t(dict, "about.title")}>
        <Image
          src="https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1800&q=85"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <span className="about-hero-veil" aria-hidden />
        <div className="about-hero-copy wrap">
          <p className="about-eyebrow">{t(dict, "about.eyebrow")}</p>
          <h1 className="about-hero-title">{t(dict, "about.title")}</h1>
          <p className="about-hero-lead">{t(dict, "about.lead")}</p>
        </div>
      </section>

      <section className="about-statement wrap">
        <Reveal>
          <p className="about-statement-text">{t(dict, "about.statement")}</p>
        </Reveal>
      </section>

      <section className="about-approach wrap">
        <Reveal>
          <p className="about-eyebrow">{t(dict, "about.eyebrow")}</p>
          <h2 className="about-section-title">{t(dict, "about.storyTitle")}</h2>
          <p className="about-section-lead">{t(dict, "about.story")}</p>
        </Reveal>

        <div className="about-feature-grid">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.key} delay={i * 70}>
                <article className="about-feature-card">
                  <span className="about-feature-icon" aria-hidden>
                    <Icon size={22} strokeWidth={1.5} />
                  </span>
                  <h3 className="about-feature-title">
                    {t(dict, `about.features.${feature.key}.title`)}
                  </h3>
                  <p className="about-feature-text">
                    {t(dict, `about.features.${feature.key}.text`)}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="about-closing">
        <div className="about-closing-media">
          <Image
            src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1800&q=85"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <span className="about-closing-veil" aria-hidden />
        </div>
        <div className="about-closing-copy wrap">
          <Reveal>
            <h2 className="about-section-title">{t(dict, "about.closingTitle")}</h2>
            <p className="about-section-lead">{t(dict, "about.closingLead")}</p>
            <div className="about-closing-actions">
              <Link href="/book" className="btn btn-copper">
                {t(dict, "about.ctaBook")}
              </Link>
              <Link href="/shop" className="btn btn-ghost about-ghost-btn">
                {t(dict, "about.ctaShop")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

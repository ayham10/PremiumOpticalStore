import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import PageAtmosphere from "@/components/PageAtmosphere";
import { getStore } from "@/lib/db/store";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About — Oyon",
  description:
    "The Oyon story — premium optical care, craftsmanship, and quiet luxury in Tel Aviv.",
};

export default async function AboutPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const team = data.staff.filter((s) => s.active).slice(0, 3);

  const craftItems = [
    t(dict, "about.craft1"),
    t(dict, "about.craft2"),
    t(dict, "about.craft3"),
  ];

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={t(dict, "about.eyebrow")}
        title={t(dict, "about.title")}
        lead={t(dict, "about.lead")}
        image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1800&q=80"
      />

      {/* Brand story */}
      <section className="section">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)]">
              <Image
                src="https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1200&q=80"
                alt="Eye examination at Oyon"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <span className="eyebrow">{t(dict, "about.eyebrow")}</span>
            <h2 className="section-title !text-[clamp(2rem,4vw,3rem)]">
              {t(dict, "about.storyTitle")}
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed">
              {t(dict, "about.story")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Craftsmanship */}
      <section className="section !pt-0">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">{t(dict, "about.eyebrow")}</span>
            <h2 className="section-title">{t(dict, "about.craftTitle")}</h2>
          </Reveal>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {craftItems.map((item, i) => (
              <Reveal key={item} delay={i * 90}>
                <div className="border-t border-[var(--line-strong)] pt-6">
                  <h3 className="font-[family-name:var(--font-display)] text-2xl">
                    {item}
                  </h3>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team teaser */}
      <section className="section bg-white/50">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">{t(dict, "about.eyebrow")}</span>
            <h2 className="section-title">{t(dict, "about.teamTitle")}</h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {team.map((member, i) => (
              <Reveal key={member.id} delay={i * 90}>
                <article>
                  <div
                    className="mb-5 aspect-[4/5] rounded-[var(--radius)]"
                    style={{
                      background: `linear-gradient(160deg, ${member.color}33, ${member.color}88), linear-gradient(180deg, #eef2f5, #dce4ec)`,
                    }}
                  />
                  <h3 className="font-[family-name:var(--font-display)] text-2xl">
                    {member.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
                    {member.title}
                  </p>
                  {member.bio && (
                    <p className="mt-3 text-sm leading-relaxed">{member.bio}</p>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary">
                {t(dict, "about.ctaBook")}
              </Link>
              <Link href="/shop" className="btn btn-ghost">
                {t(dict, "about.ctaShop")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

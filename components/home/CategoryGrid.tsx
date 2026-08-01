"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

const CARDS = [
  {
    key: "eyewear" as const,
    href: "/shop?category=Frames",
    image:
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "exam" as const,
    href: "/book?service=Eye%20Examination",
    image:
      "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "contacts" as const,
    href: "/shop?category=Contact%20Lenses",
    image:
      "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "sunglasses" as const,
    href: "/shop?category=Sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "kids" as const,
    href: "/services#kids",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "care" as const,
    href: "/services",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function CategoryGrid() {
  const { t } = useLocale();

  return (
    <section className="section">
      <div className="wrap">
        <div className="max-w-2xl">
          <span className="eyebrow">{t("home.categoriesEyebrow")}</span>
          <h2 className="section-title">{t("home.categoriesTitle")}</h2>
          <p className="section-lead">{t("home.categoriesLead")}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, index) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={card.href}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[1.4rem]"
              >
                <Image
                  src={card.image}
                  alt={t(`home.cards.${card.key}.title`)}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10 transition group-hover:from-black/80" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    {t(`home.cards.${card.key}.subtitle`)}
                  </div>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                    {t(`home.cards.${card.key}.title`)}
                  </h3>
                  <span className="mt-4 inline-flex text-sm font-semibold tracking-wide text-white/90 underline decoration-white/35 underline-offset-4 transition group-hover:decoration-white">
                    {t(`home.cards.${card.key}.cta`)}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

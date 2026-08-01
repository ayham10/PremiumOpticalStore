"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

const SECTIONS = [
  {
    key: "frames",
    href: "/shop?category=Frames",
    image:
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_28%]",
  },
  {
    key: "exams",
    href: "/book?service=Eye%20Examination",
    image:
      "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_22%]",
  },
  {
    key: "sunglasses",
    href: "/shop?category=Sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_35%]",
  },
  {
    key: "contacts",
    href: "/shop?category=Contact%20Lenses",
    image:
      "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_30%]",
  },
  {
    key: "promotions",
    href: "/#offers",
    image:
      "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_40%]",
  },
  {
    key: "booking",
    href: "/book",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_25%]",
  },
  {
    key: "contact",
    href: "/contact",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80",
    position: "object-[center_40%]",
  },
] as const;

export default function GatewaySections() {
  const { t } = useLocale();

  return (
    <div>
      {SECTIONS.map((section, index) => (
        <Link
          key={section.key}
          href={section.href}
          className="group relative block gateway-panel overflow-hidden text-white"
        >
          <Image
            src={section.image}
            alt={t(`home.gateway.${section.key}.title`)}
            fill
            priority={index < 2}
            sizes="(max-width: 768px) 100vw, 100vw"
            className={`object-cover transition duration-[1.25s] ease-out group-hover:scale-[1.04] md:object-center ${section.position}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 transition group-hover:from-black/90" />

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-10 flex items-end"
          >
            <div className="wrap w-full py-12 sm:py-16 md:py-20">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-xs sm:tracking-[0.28em]">
                {t(`home.gateway.${section.key}.subtitle`)}
              </p>
              <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[clamp(2rem,8vw,4.4rem)] leading-[1.02]">
                {t(`home.gateway.${section.key}.title`)}
              </h2>
              <span className="btn btn-glass pointer-events-none mt-6 inline-flex min-h-12 sm:mt-8">
                {t(`home.gateway.${section.key}.cta`)}
                <span aria-hidden className="transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}

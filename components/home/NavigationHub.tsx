"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "@/components/i18n/LocaleProvider";

const TILES = [
  {
    key: "frames",
    href: "/frames",
    image:
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_40%]",
  },
  {
    key: "exams",
    href: "/eye-exams",
    image:
      "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_30%]",
  },
  {
    key: "sunglasses",
    href: "/sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_28%]",
  },
  {
    key: "contacts",
    href: "/contact-lenses",
    image:
      "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_35%]",
  },
  {
    key: "promotions",
    href: "/promotions",
    image:
      "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_45%]",
  },
  {
    key: "booking",
    href: "/book",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80",
    position: "object-[center_40%]",
  },
] as const;

export default function NavigationHub() {
  const { t } = useLocale();

  return (
    <section id="home-nav" className="home-nav-section">
      <div className="home-nav-inner">
        <div className="home-nav-grid">
          {TILES.map((tile, index) => (
            <motion.div
              key={tile.key}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{
                duration: 0.5,
                delay: index * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="min-h-0"
            >
              <Link href={tile.href} className="home-nav-card group">
                <Image
                  src={tile.image}
                  alt={t(`home.gateway.${tile.key}.title`)}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className={`object-cover transition duration-700 ease-out group-hover:scale-[1.06] ${tile.position}`}
                  priority={index < 3}
                />
                <span className="home-nav-card-shade" />
                <span className="home-nav-card-copy">
                  <span className="home-nav-card-title">
                    {t(`home.gateway.${tile.key}.title`)}
                  </span>
                  <span className="home-nav-card-desc">
                    {t(`home.gateway.${tile.key}.subtitle`)}
                  </span>
                  <span className="home-nav-card-cta">
                    {t(`home.gateway.${tile.key}.cta`)}
                    <span aria-hidden className="transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
                      →
                    </span>
                  </span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

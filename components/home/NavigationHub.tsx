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
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1600&q=85",
    position: "object-[center_45%]",
  },
  {
    key: "exams",
    href: "/eye-exams",
    image: "/images/card-eye-exams.jpg",
    position: "home-card-img--exams",
  },
  {
    key: "sunglasses",
    href: "/sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1600&q=85",
    position: "object-[center_25%]",
  },
  {
    key: "contacts",
    href: "/contact-lenses",
    image: "/images/card-contact-lenses.jpg",
    position: "home-card-img--contacts",
  },
  {
    key: "promotions",
    href: "/promotions",
    image:
      "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1600&q=85",
    position: "object-[center_50%]",
  },
  {
    key: "booking",
    href: "/book",
    image:
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=85",
    position: "object-[center_40%]",
  },
] as const;

export default function NavigationHub() {
  const { t } = useLocale();

  return (
    <section className="home-hub" aria-label={t("home.hubEyebrow")}>
      <div className="home-hub-shell">
        <div className="home-hub-grid">
          {TILES.map((tile, index) => (
            <motion.div
              key={tile.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.08 + index * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link href={tile.href} className="home-card group">
                <Image
                  src={tile.image}
                  alt={t(`home.gateway.${tile.key}.title`)}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  className={`object-cover transition duration-[800ms] ease-out group-hover:scale-[1.05] ${tile.position}`}
                  priority={index < 3}
                />
                <span className="home-card-shade" aria-hidden />
                <span className="home-card-content">
                  <span className="home-card-text">
                    <span className="home-card-title">
                      {t(`home.gateway.${tile.key}.title`)}
                    </span>
                    <span className="home-card-sub">
                      {t(`home.gateway.${tile.key}.subtitle`)}
                    </span>
                  </span>
                  <span className="home-card-arrow" aria-hidden>
                    →
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

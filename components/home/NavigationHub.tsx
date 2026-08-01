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
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_28%]",
  },
  {
    key: "exams",
    href: "/eye-exams",
    image:
      "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_22%]",
  },
  {
    key: "sunglasses",
    href: "/sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_35%]",
  },
  {
    key: "contacts",
    href: "/contact-lenses",
    image:
      "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_30%]",
  },
  {
    key: "booking",
    href: "/book",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_25%]",
  },
  {
    key: "promotions",
    href: "/promotions",
    image:
      "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_40%]",
  },
  {
    key: "contact",
    href: "/contact",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_40%]",
  },
  {
    key: "about",
    href: "/about",
    image:
      "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_30%]",
  },
  {
    key: "shop",
    href: "/shop",
    image:
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=80",
    position: "object-[center_35%]",
  },
] as const;

export default function NavigationHub() {
  const { t } = useLocale();

  return (
    <div className="home-hub">
      <div className="home-hub-bg" aria-hidden />

      <div className="home-hub-inner">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="home-hub-header"
        >
          <p className="home-hub-brand">
            LUM<span style={{ color: "#9ec9e6" }}>I</span>NA
            <span className="home-hub-brand-suffix"> OPTICAL</span>
          </p>
          <p className="home-hub-eyebrow">{t("home.hubEyebrow")}</p>
        </motion.header>

        <div className="home-hub-grid">
          {TILES.map((tile, index) => (
            <motion.div
              key={tile.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.05 + index * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="min-h-0"
            >
              <Link href={tile.href} className="home-hub-tile group">
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 360px"
                  className={`object-cover transition duration-700 group-hover:scale-[1.05] ${tile.position}`}
                  priority={index < 6}
                />
                <span className="home-hub-tile-shade" />
                <span className="home-hub-tile-copy">
                  <span className="home-hub-tile-sub">
                    {t(`home.gateway.${tile.key}.subtitle`)}
                  </span>
                  <span className="home-hub-tile-title">
                    {t(`home.gateway.${tile.key}.title`)}
                  </span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

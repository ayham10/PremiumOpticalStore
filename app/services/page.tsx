"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import PageAtmosphere from "@/components/PageAtmosphere";
import { useLocale } from "@/components/i18n/LocaleProvider";

const SERVICE_KEYS = [
  "Eye Examination",
  "Prescription Glasses",
  "Contact Lenses",
  "Sunglasses Fitting",
  "Eyeglass Frames",
  "Vision Consultation",
  "Kids Eye Exams",
  "Repairs & Adjustments",
] as const;

const SERVICE_META: Record<
  (typeof SERVICE_KEYS)[number],
  { href: string; image: string; id?: string; bookKey?: string }
> = {
  "Eye Examination": {
    href: "/book?service=Eye%20Examination",
    image:
      "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1200&q=80",
    bookKey: "Eye Examination",
  },
  "Prescription Glasses": {
    href: "/book?service=Prescription%20Glasses",
    image:
      "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1200&q=80",
  },
  "Contact Lenses": {
    href: "/book?service=Contact%20Lenses",
    image:
      "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=1200&q=80",
  },
  "Sunglasses Fitting": {
    href: "/shop?category=Sunglasses",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
  },
  "Eyeglass Frames": {
    href: "/shop?category=Frames",
    image:
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1200&q=80",
  },
  "Vision Consultation": {
    href: "/book?service=Vision%20Consultation",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
  },
  "Kids Eye Exams": {
    href: "/book?service=Eye%20Examination",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=80",
    id: "kids",
  },
  "Repairs & Adjustments": {
    href: "/contact",
    image:
      "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=1200&q=80",
  },
};

export default function ServicesPage() {
  const { t } = useLocale();

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={t("servicesPage.eyebrow")}
        title={t("servicesPage.title")}
        lead={t("servicesPage.lead")}
        image="https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1800&q=80"
      />
      <section className="wrap relative z-10">
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {SERVICE_KEYS.map((key, index) => {
            const meta = SERVICE_META[key];
            return (
              <motion.article
                id={meta.id}
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: index * 0.04 }}
                className="group overflow-hidden rounded-[1.4rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={meta.image}
                    alt={t(`servicesPage.items.${key}.title`)}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
                <div className="p-6 md:p-7">
                  <h2 className="font-[family-name:var(--font-display)] text-3xl">
                    {t(`servicesPage.items.${key}.title`)}
                  </h2>
                  <p className="mt-3 text-[var(--slate)]">
                    {t(`servicesPage.items.${key}.description`)}
                  </p>
                  <Link href={meta.href} className="btn btn-primary mt-6 !min-h-11 !px-5 !text-sm">
                    {t("servicesPage.bookCta")}
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

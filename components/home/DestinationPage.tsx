"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import PageAtmosphere from "@/components/PageAtmosphere";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function DestinationPage({
  destKey,
  image,
  video,
  primaryHref,
  secondaryHref,
  gallery,
}: {
  destKey: "frames" | "exams" | "sunglasses" | "contacts" | "promotions";
  image: string;
  video?: string;
  primaryHref: string;
  secondaryHref?: string;
  gallery?: string[];
}) {
  const { dict } = useLocale();
  const dest = dict.destinations[destKey];

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={dest.eyebrow}
        title={dest.title}
        lead={dest.lead}
        image={image}
        video={video}
      />

      <section className="wrap relative z-10">
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <p className="max-w-2xl text-[1.05rem] leading-relaxed text-[var(--slate)]">
              {dest.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={primaryHref} className="btn btn-primary">
                {dest.primaryCta}
              </Link>
              {secondaryHref ? (
                <Link href={secondaryHref} className="btn btn-ghost">
                  {dest.secondaryCta}
                </Link>
              ) : null}
            </div>
          </motion.div>

          <div className="grid gap-6">
            {dest.highlights.map((item, i) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="border-s-2 border-[var(--accent)] ps-4"
              >
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--slate)]">
                  {item.text}
                </p>
              </motion.article>
            ))}
          </div>
        </div>

        {gallery?.length ? (
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((src, i) => (
              <motion.div
                key={src}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem]"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover object-[center_28%]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </motion.div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

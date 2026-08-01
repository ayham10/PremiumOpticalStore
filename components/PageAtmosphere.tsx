"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function PageAtmosphere({
  eyebrow,
  title,
  lead,
  image,
  video,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  image: string;
  video?: string;
}) {
  return (
    <section className="relative min-h-[52svh] overflow-hidden text-white md:min-h-[58svh]">
      {video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={image}
        />
      ) : (
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-black/45 to-black/30" />
      <div className="relative z-10 flex min-h-[52svh] items-end pb-12 pt-28 md:min-h-[58svh] md:pb-16">
        <div className="wrap max-w-3xl">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow !text-[#9ec9e6]"
          >
            {eyebrow}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.4rem,6vw,4.2rem)] text-white"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="mt-4 max-w-xl text-[1.05rem] text-white/78"
          >
            {lead}
          </motion.p>
        </div>
      </div>
    </section>
  );
}

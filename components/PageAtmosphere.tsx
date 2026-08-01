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
    <section className="relative min-h-[48svh] overflow-hidden text-white sm:min-h-[52svh] md:min-h-[58svh]">
      {video ? (
        <video
          className="hero-video"
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
          className="media-cover object-cover object-[center_28%] md:object-center"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07090d] via-black/45 to-black/30" />
      <div className="relative z-10 flex min-h-[48svh] items-center justify-center pb-12 pt-28 text-center sm:min-h-[52svh] md:min-h-[58svh] md:items-end md:justify-start md:pb-16 md:text-start">
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
            className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,7vw,4.2rem)] text-white"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="mx-auto mt-4 max-w-xl text-[0.98rem] text-white/78 sm:text-[1.05rem] md:mx-0"
          >
            {lead}
          </motion.p>
        </div>
      </div>
    </section>
  );
}

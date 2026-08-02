"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success";
}

const tones = {
  default: { bg: "rgba(212,175,106,0.12)", color: "#D4AF6A" },
  warning: { bg: "rgba(212,175,106,0.16)", color: "#E6C58A" },
  success: { bg: "rgba(94,196,154,0.14)", color: "#5EC49A" },
};

export default function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  const t = tones[tone];

  const body = (
    <motion.div
      className="admin-card p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[var(--slate)]">
            {label}
          </p>
          <p
            className="mt-2 text-3xl text-[var(--ink)]"
            style={{
              fontFamily: "Fraunces, serif",
              color: tone === "warning" ? "#D4AF6A" : undefined,
            }}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-2 text-sm font-medium text-[var(--accent)]">
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: t.bg, color: t.color }}
        >
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {body}
      </Link>
    );
  }

  return body;
}

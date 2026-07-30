"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success";
}

const tones = {
  default: { bg: "var(--accent-wash)", color: "var(--accent)" },
  warning: { bg: "#fff4df", color: "var(--warning)" },
  success: { bg: "#e7f5f0", color: "var(--success)" },
};

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  const t = tones[tone];

  return (
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
            className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-sm text-[var(--slate)]">{hint}</p>
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
}

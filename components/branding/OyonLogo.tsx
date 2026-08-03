"use client";

import Link from "next/link";
import { cn } from "@/lib/format";

type OyonLogoProps = {
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** When false, render as a non-link mark */
  link?: boolean;
  onClick?: () => void;
};

const sizeMap = {
  sm: "oyon-logo--sm",
  md: "oyon-logo--md",
  lg: "oyon-logo--lg",
  xl: "oyon-logo--xl",
} as const;

/**
 * Approved bilingual brand mark: OYON over عيون with gold decorative lines.
 * Always shows both Latin and Arabic — this is the brand identity, not UI copy.
 */
export default function OyonLogo({
  href = "/",
  className = "",
  size = "md",
  link = true,
  onClick,
}: OyonLogoProps) {
  const mark = (
    <span className={cn("oyon-logo", sizeMap[size], className)} aria-label="OYON">
      <span className="oyon-logo-en">OYON</span>
      <span className="oyon-logo-ar-row" aria-hidden="true">
        <span className="oyon-logo-line" />
        <span className="oyon-logo-ar">عيون</span>
        <span className="oyon-logo-line" />
      </span>
    </span>
  );

  if (!link || href == null) {
    return mark;
  }

  return (
    <Link
      href={href || "/"}
      className="oyon-logo-link inline-flex no-underline"
      onClick={onClick}
      aria-label="OYON"
    >
      {mark}
    </Link>
  );
}

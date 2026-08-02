"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  brandNameForLocale,
  mergeBranding,
} from "@/lib/branding";
import type { BrandingSettings } from "@/lib/types";

type BrandMarkProps = {
  branding?: BrandingSettings | null;
  href?: string | null;
  className?: string;
  suffix?: string;
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  /** When false, render as a span (no navigation) */
  link?: boolean;
};

export default function BrandMark({
  branding,
  href = "/",
  className = "",
  suffix,
  size = "md",
  onDark = false,
  link = true,
}: BrandMarkProps) {
  const { locale, t } = useLocale();
  const b = mergeBranding(branding);
  const name = brandNameForLocale(branding || b, locale, t("hero.brand"));
  const style = b.storeNameStyle;
  const showLogo = style.showLogo && Boolean(b.logo);

  const sizeClass =
    size === "lg"
      ? "text-[1.75rem] sm:text-[2rem]"
      : size === "sm"
        ? "text-[1.1rem] sm:text-[1.2rem]"
        : "text-[1.35rem] sm:text-[1.5rem]";

  const nameStyle: CSSProperties = {
    color: style.goldGradient ? undefined : style.color || "var(--brand-gold)",
    fontWeight: style.fontWeight || 500,
    letterSpacing: style.letterSpacing || "0.1em",
    textTransform: style.textTransform || "none",
    fontFamily: "var(--brand-heading-font, var(--font-display))",
    backgroundImage: style.goldGradient
      ? "linear-gradient(120deg, #E6C58A 0%, #D4AF6A 45%, #B8914A 100%)"
      : undefined,
    WebkitBackgroundClip: style.goldGradient ? "text" : undefined,
    backgroundClip: style.goldGradient ? "text" : undefined,
    WebkitTextFillColor: style.goldGradient ? "transparent" : undefined,
    textShadow: style.glow
      ? "0 0 18px rgba(212,175,106,0.45), 0 0 4px rgba(212,175,106,0.35)"
      : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    textUnderlineOffset: style.underline ? "0.22em" : undefined,
  };

  const content = (
    <span className={`brand-mark inline-flex items-center gap-2 ${className}`}>
      {showLogo ? (
        <span
          className={`brand-mark-logo relative shrink-0 overflow-hidden rounded-md ${
            size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8"
          }`}
        >
          <Image
            src={b.logo!}
            alt={name}
            fill
            className="object-contain"
            sizes="40px"
            unoptimized
          />
        </span>
      ) : null}
      <span className={`brand-mark-text ${sizeClass}`} style={nameStyle}>
        {name}
        {suffix ? (
          <span
            className={`ms-1 ${
              size === "sm" ? "text-[0.55em]" : "text-[0.62em]"
            } tracking-[0.18em] ${onDark ? "opacity-70" : "opacity-60"}`}
            style={{
              color: style.goldGradient ? undefined : style.color,
              WebkitTextFillColor: style.goldGradient ? "transparent" : undefined,
              backgroundImage: style.goldGradient
                ? "linear-gradient(120deg, #E6C58A 0%, #D4AF6A 45%, #B8914A 100%)"
                : undefined,
              WebkitBackgroundClip: style.goldGradient ? "text" : undefined,
              backgroundClip: style.goldGradient ? "text" : undefined,
              fontWeight: Math.max(400, (style.fontWeight || 500) - 100),
            }}
          >
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!link || href == null) return content;
  return (
    <Link href={href || "/"} className="inline-flex items-center no-underline">
      {content}
    </Link>
  );
}

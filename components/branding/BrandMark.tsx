"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import OyonLogo from "@/components/branding/OyonLogo";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { mergeBranding } from "@/lib/branding";
import type { BrandingSettings } from "@/lib/types";

type BrandMarkProps = {
  branding?: BrandingSettings | null;
  href?: string | null;
  className?: string;
  /** @deprecated Kept for API compatibility; dual mark is the identity */
  suffix?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onDark?: boolean;
  /** When false, render as a span (no navigation) */
  link?: boolean;
  onClick?: () => void;
};

/**
 * Public brand mark — approved OYON / عيون identity.
 * Falls back to an uploaded logo asset when branding explicitly enables it.
 */
export default function BrandMark({
  branding,
  href = "/",
  className = "",
  size = "md",
  link = true,
  onClick,
}: BrandMarkProps) {
  const { t } = useLocale();
  const b = mergeBranding(branding);
  const style = b.storeNameStyle;
  const showUploaded = style.showLogo && Boolean(b.logo);

  if (showUploaded) {
    const sizePx =
      size === "xl" || size === "lg"
        ? "h-11 w-auto max-w-[10rem]"
        : size === "sm"
          ? "h-7 w-auto max-w-[7rem]"
          : "h-9 w-auto max-w-[8.5rem]";

    const content = (
      <span className={`brand-mark inline-flex items-center ${className}`}>
        <span className={`brand-mark-logo relative shrink-0 overflow-hidden ${sizePx}`}>
          <Image
            src={b.logo!}
            alt={t("hero.brand")}
            width={160}
            height={48}
            className="h-full w-auto object-contain"
            unoptimized
          />
        </span>
      </span>
    );

    if (!link || href == null) return content;
    return (
      <Link
        href={href || "/"}
        className="inline-flex items-center no-underline"
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <OyonLogo
      href={href}
      link={link}
      size={size === "xl" ? "xl" : size}
      className={className}
      onClick={onClick}
    />
  );
}

/** Optional gold text style helper for legacy callers */
export function brandGoldStyle(branding?: BrandingSettings | null): CSSProperties {
  const b = mergeBranding(branding);
  const style = b.storeNameStyle;
  return {
    color: style.goldGradient ? undefined : style.color || "var(--brand-gold)",
    fontFamily: "var(--brand-heading-font, var(--font-display))",
    backgroundImage: style.goldGradient
      ? "linear-gradient(120deg, #E6C58A 0%, #D4AF6A 45%, #B8914A 100%)"
      : undefined,
    WebkitBackgroundClip: style.goldGradient ? "text" : undefined,
    backgroundClip: style.goldGradient ? "text" : undefined,
    WebkitTextFillColor: style.goldGradient ? "transparent" : undefined,
  };
}

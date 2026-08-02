import type { BrandingSettings } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

/** Premium luxury optical defaults from the Oyon design system */
export const DEFAULT_BRANDING: BrandingSettings = {
  storeNameEn: "Oyon",
  storeNameAr: "عيون",
  storeNameHe: "עיון",
  logo: "",
  favicon: "",
  colors: {
    primaryAccent: "#D4AF37",
    secondaryAccent: "#E6C85A",
    gold: "#D4AF37",
    button: "#D4AF37",
    buttonHover: "#E6C85A",
    text: "#FFFFFF",
    textSecondary: "#A7ADB5",
    background: "#0B0F14",
    card: "#131A22",
    border: "rgba(255,255,255,0.06)",
  },
  typography: {
    headingFont: "Fraunces",
    bodyFont: "Manrope",
    fontScale: 1,
  },
  storeNameStyle: {
    color: "#D4AF37",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "none",
    goldGradient: false,
    glow: false,
    underline: false,
    showLogo: true,
  },
};

export const BRANDING_FONT_OPTIONS = [
  "Fraunces",
  "Manrope",
  "Playfair Display",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Space Grotesk",
  "DM Sans",
  "Noto Naskh Arabic",
  "Noto Sans Hebrew",
] as const;

export function mergeBranding(
  partial?: Partial<BrandingSettings> | null,
): BrandingSettings {
  return {
    ...DEFAULT_BRANDING,
    ...(partial || {}),
    colors: {
      ...DEFAULT_BRANDING.colors,
      ...(partial?.colors || {}),
    },
    typography: {
      ...DEFAULT_BRANDING.typography,
      ...(partial?.typography || {}),
    },
    storeNameStyle: {
      ...DEFAULT_BRANDING.storeNameStyle,
      ...(partial?.storeNameStyle || {}),
    },
  };
}

export function brandNameForLocale(
  branding: BrandingSettings,
  locale: Locale | string,
  fallback = "Oyon",
): string {
  if (locale === "ar") {
    return branding.storeNameAr?.trim() || branding.storeNameEn?.trim() || fallback;
  }
  if (locale === "he") {
    return (
      branding.storeNameHe?.trim() ||
      branding.storeNameEn?.trim() ||
      fallback
    );
  }
  return branding.storeNameEn?.trim() || fallback;
}

/** Build :root CSS custom properties from branding */
export function brandingToCssVars(branding: BrandingSettings): Record<string, string> {
  const b = mergeBranding(branding);
  const c = b.colors;
  const t = b.typography;
  const s = b.storeNameStyle;
  const scale = Math.min(1.35, Math.max(0.85, Number(t.fontScale) || 1));

  return {
    "--brand-primary": c.primaryAccent,
    "--brand-secondary": c.secondaryAccent,
    "--brand-gold": c.gold,
    "--brand-button": c.button,
    "--brand-button-hover": c.buttonHover,
    "--brand-text": c.text,
    "--brand-text-secondary": c.textSecondary,
    "--brand-bg": c.background,
    "--brand-card": c.card,
    "--brand-border": c.border,
    "--brand-heading-font": `"${t.headingFont}", ui-serif, Georgia, serif`,
    "--brand-body-font": `"${t.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
    "--brand-font-scale": String(scale),
    "--brand-name-color": s.color,
    "--brand-name-weight": String(s.fontWeight),
    "--brand-name-tracking": s.letterSpacing,
    "--brand-name-transform": s.textTransform,
    // Map into existing site tokens (light + luxury accents)
    "--copper": c.gold,
    "--copper-soft": c.secondaryAccent,
    "--accent": c.primaryAccent,
    "--accent-soft": c.secondaryAccent,
    "--accent-wash": hexToRgba(c.primaryAccent, 0.12),
    "--font-display": `"${t.headingFont}", ui-serif, Georgia, serif`,
    "--font-sans": `"${t.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
    // Dark page tokens
    "--frames-bg": c.background,
    "--frames-card": c.card,
    "--frames-text": c.text,
    "--frames-muted": c.textSecondary,
    "--frames-line": c.border,
    "--frames-gold": c.gold,
    "--product-bg": c.background,
    "--product-surface": c.card,
    "--product-card": c.card,
    "--product-text": c.text,
    "--product-muted": c.textSecondary,
    "--product-line": c.border,
    "--product-gold": c.gold,
    "--ee-bg": c.background,
    "--ee-surface": c.card,
    "--ee-card": c.card,
    "--ee-text": c.text,
    "--ee-muted": c.textSecondary,
    "--ee-line": c.border,
    "--ee-gold": c.gold,
  };
}

export function brandingCssText(branding: BrandingSettings): string {
  const vars = brandingToCssVars(branding);
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
  return `:root {\n  ${body}\n}`;
}

export function googleFontsHref(branding: BrandingSettings): string | null {
  const b = mergeBranding(branding);
  const families = Array.from(
    new Set([b.typography.headingFont, b.typography.bodyFont]),
  ).filter(
    (f) =>
      f &&
      ![
        "Fraunces",
        "Manrope",
        "Noto Naskh Arabic",
        "Noto Sans Hebrew",
      ].includes(f),
  );
  if (!families.length) return null;
  const q = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 3 && raw.length !== 6) {
    return `rgba(212, 175, 106, ${alpha})`;
  }
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

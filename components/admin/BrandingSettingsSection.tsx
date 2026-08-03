"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  BRANDING_FONT_OPTIONS,
  mergeBranding,
} from "@/lib/branding";
import OyonLogo from "@/components/branding/OyonLogo";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { BrandingSettings, StoreSettings } from "@/lib/types";

type Props = {
  value: StoreSettings;
  onChange: (next: StoreSettings) => void;
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isRgba = value.trim().startsWith("rgba") || value.trim().startsWith("rgb");
  return (
    <label className="block space-y-1.5">
      <span className="label">{label}</span>
      <div className="admin-color-field">
        <input
          className="input flex-1 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#D4AF6A"
        />
        {!isRgba ? (
          <input
            type="color"
            className="admin-color-swatch"
            value={value.startsWith("#") ? value : "#D4AF6A"}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
          />
        ) : null}
      </div>
    </label>
  );
}

async function uploadAsset(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", "general");
  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Upload failed");
  }
  return data.url;
}

export default function BrandingSettingsSection({ value, onChange }: Props) {
  const { t } = useLocale();
  const branding = useMemo(
    () => mergeBranding(value.branding),
    [value.branding],
  );
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [uploadError, setUploadError] = useState("");

  function patchBranding(patch: Partial<BrandingSettings>) {
    const next = mergeBranding({ ...branding, ...patch });
    onChange({
      ...value,
      storeName: next.storeNameEn || value.storeName,
      logo: next.logo || value.logo,
      branding: next,
    });
  }

  function patchColors(key: keyof BrandingSettings["colors"], v: string) {
    patchBranding({ colors: { ...branding.colors, [key]: v } });
  }

  function patchType(key: keyof BrandingSettings["typography"], v: string | number) {
    patchBranding({ typography: { ...branding.typography, [key]: v } });
  }

  function patchNameStyle(
    key: keyof BrandingSettings["storeNameStyle"],
    v: string | number | boolean,
  ) {
    patchBranding({
      storeNameStyle: { ...branding.storeNameStyle, [key]: v },
    });
  }

  async function onUpload(kind: "logo" | "favicon", file: File | null) {
    if (!file) return;
    setUploading(kind);
    setUploadError("");
    try {
      const url = await uploadAsset(file);
      if (kind === "logo") {
        patchBranding({ logo: url, storeNameStyle: { ...branding.storeNameStyle, showLogo: true } });
      } else {
        patchBranding({ favicon: url });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Store identity — compact premium card matching reference */}
      <section className="admin-card admin-identity-card space-y-5 p-5">
        <h2 className="admin-section-title">{t("admin.settings.identity")}</h2>

        {uploadError ? (
          <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
            {uploadError}
          </p>
        ) : null}

        <div className="admin-identity-names">
          <div>
            <label className="label">{t("admin.settings.storeNameAr")}</label>
            <input
              className="input"
              dir="rtl"
              value={branding.storeNameAr}
              onChange={(e) => patchBranding({ storeNameAr: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("admin.settings.storeNameEn")}</label>
            <input
              className="input"
              value={branding.storeNameEn}
              onChange={(e) => patchBranding({ storeNameEn: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("admin.settings.storeNameHe")}</label>
            <input
              className="input"
              dir="rtl"
              value={branding.storeNameHe || ""}
              onChange={(e) => patchBranding({ storeNameHe: e.target.value })}
            />
          </div>
        </div>

        <div className="admin-identity-media">
          <div className="admin-identity-logo">
            <label className="label">{t("admin.settings.storeLogo")}</label>
            <div className="admin-logo-preview">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="" className="admin-logo-preview-img" />
              ) : (
                <OyonLogo link={false} size="lg" />
              )}
            </div>
            <label className="admin-upload-link">
              <Upload size={15} />
              {uploading === "logo"
                ? t("admin.settings.saving")
                : t("admin.settings.changeLogo")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) =>
                  void onUpload("logo", e.target.files?.[0] || null)
                }
              />
            </label>
          </div>

          <div className="admin-identity-side">
            <div>
              <label className="label">{t("admin.settings.faviconUrl")}</label>
              <div className="admin-favicon-row">
                <span className="admin-favicon-preview" aria-hidden>
                  {branding.favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding.favicon} alt="" />
                  ) : (
                    <span className="admin-favicon-fallback">
                      {(branding.storeNameEn || "O").charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <label className="admin-upload-link admin-upload-link--inline">
                  <Upload size={15} />
                  {uploading === "favicon"
                    ? t("admin.settings.saving")
                    : t("admin.settings.changeFavicon")}
                  <input
                    type="file"
                    accept="image/*,.ico"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) =>
                      void onUpload("favicon", e.target.files?.[0] || null)
                    }
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="label">{t("admin.settings.tagline")}</label>
              <input
                className="input"
                value={value.tagline}
                onChange={(e) =>
                  onChange({ ...value, tagline: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="admin-card space-y-4 p-5">
        <h2 className="admin-section-title">{t("admin.settings.colors")}</h2>
        <div className="admin-colors-row">
          <ColorField
            label={t("admin.settings.primaryColor")}
            value={branding.colors.primaryAccent}
            onChange={(v) => patchColors("primaryAccent", v)}
          />
          <ColorField
            label={t("admin.settings.secondaryColor")}
            value={branding.colors.gold}
            onChange={(v) => patchColors("gold", v)}
          />
          <ColorField
            label={t("admin.settings.textColor")}
            value={branding.colors.text}
            onChange={(v) => patchColors("text", v)}
          />
          <ColorField
            label={t("admin.settings.backgroundColor")}
            value={branding.colors.background}
            onChange={(v) => patchColors("background", v)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField
            label={t("admin.settings.secondaryColor")}
            value={branding.colors.secondaryAccent}
            onChange={(v) => patchColors("secondaryAccent", v)}
          />
          <ColorField
            label="Button"
            value={branding.colors.button}
            onChange={(v) => patchColors("button", v)}
          />
          <ColorField
            label="Button hover"
            value={branding.colors.buttonHover}
            onChange={(v) => patchColors("buttonHover", v)}
          />
          <ColorField
            label="Secondary text"
            value={branding.colors.textSecondary}
            onChange={(v) => patchColors("textSecondary", v)}
          />
          <ColorField
            label="Card"
            value={branding.colors.card}
            onChange={(v) => patchColors("card", v)}
          />
          <ColorField
            label="Border"
            value={branding.colors.border}
            onChange={(v) => patchColors("border", v)}
          />
        </div>
      </section>

      {/* Advanced branding (unchanged capabilities, below identity) */}
      <section className="admin-card space-y-4 p-5">
        <h2 className="admin-section-title text-base">Typography</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Heading font</label>
            <select
              className="select"
              value={branding.typography.headingFont}
              onChange={(e) => patchType("headingFont", e.target.value)}
            >
              {BRANDING_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Body font</label>
            <select
              className="select"
              value={branding.typography.bodyFont}
              onChange={(e) => patchType("bodyFont", e.target.value)}
            >
              {BRANDING_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Font size scale ({branding.typography.fontScale.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.85}
              max={1.35}
              step={0.01}
              className="mt-3 w-full"
              value={branding.typography.fontScale}
              onChange={(e) => patchType("fontScale", Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="admin-card space-y-4 p-5">
        <h2 className="admin-section-title text-base">Store name styling</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField
            label="Name color"
            value={branding.storeNameStyle.color}
            onChange={(v) => patchNameStyle("color", v)}
          />
          <div>
            <label className="label">Font weight</label>
            <select
              className="select"
              value={branding.storeNameStyle.fontWeight}
              onChange={(e) =>
                patchNameStyle("fontWeight", Number(e.target.value))
              }
            >
              {[300, 400, 500, 600, 700].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Letter spacing</label>
            <input
              className="input"
              value={branding.storeNameStyle.letterSpacing}
              onChange={(e) => patchNameStyle("letterSpacing", e.target.value)}
              placeholder="0.1em"
            />
          </div>
          <div>
            <label className="label">Case</label>
            <select
              className="select"
              value={branding.storeNameStyle.textTransform}
              onChange={(e) =>
                patchNameStyle(
                  "textTransform",
                  e.target.value as BrandingSettings["storeNameStyle"]["textTransform"],
                )
              }
            >
              <option value="none">As typed</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["goldGradient", "Gold gradient"],
              ["glow", "Glow effect"],
              ["underline", "Underline"],
              ["showLogo", "Show logo next to name"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(branding.storeNameStyle[key])}
                onChange={(e) => patchNameStyle(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

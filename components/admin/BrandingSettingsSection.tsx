"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Upload } from "lucide-react";
import {
  BRANDING_FONT_OPTIONS,
  mergeBranding,
} from "@/lib/branding";
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
      <div className="flex items-center gap-2">
        {!isRgba ? (
          <input
            type="color"
            className="h-11 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--admin-elevated,#181F26)] p-1"
            value={value.startsWith("#") ? value : "#D4AF6A"}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : null}
        <input
          className="input flex-1 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#D4AF6A"
        />
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
      if (kind === "logo") patchBranding({ logo: url });
      else patchBranding({ favicon: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const previewNameStyle: CSSProperties = {
    color: branding.storeNameStyle.goldGradient
      ? undefined
      : branding.storeNameStyle.color,
    fontWeight: branding.storeNameStyle.fontWeight,
    letterSpacing: branding.storeNameStyle.letterSpacing,
    textTransform: branding.storeNameStyle.textTransform,
    fontFamily: `"${branding.typography.headingFont}", serif`,
    backgroundImage: branding.storeNameStyle.goldGradient
      ? "linear-gradient(120deg, #E6C58A 0%, #D4AF6A 45%, #B8914A 100%)"
      : undefined,
    WebkitBackgroundClip: branding.storeNameStyle.goldGradient
      ? "text"
      : undefined,
    backgroundClip: branding.storeNameStyle.goldGradient ? "text" : undefined,
    WebkitTextFillColor: branding.storeNameStyle.goldGradient
      ? "transparent"
      : undefined,
    textShadow: branding.storeNameStyle.glow
      ? "0 0 18px rgba(212,175,106,0.45)"
      : undefined,
    textDecoration: branding.storeNameStyle.underline ? "underline" : undefined,
    textUnderlineOffset: "0.22em",
    fontSize: `${1.5 * (branding.typography.fontScale || 1)}rem`,
  };

  return (
    <section className="admin-card space-y-5 p-5">
      <div>
        <h2 className="admin-section-title">
          Branding & theme
        </h2>
        <p className="admin-page-desc mt-2">
          Customize brand, colors, and typography. Preview updates live; save to
          apply site-wide.
        </p>
      </div>

      {uploadError ? (
        <p className="rounded-xl bg-[#fdeaea] px-3 py-2 text-sm text-[var(--danger)]">
          {uploadError}
        </p>
      ) : null}

      {/* Live preview */}
      <div
        className="overflow-hidden rounded-2xl border p-5"
        style={{
          background: branding.colors.background,
          borderColor: branding.colors.border,
          color: branding.colors.text,
        }}
      >
        <p
          className="text-[0.68rem] font-semibold uppercase tracking-[0.2em]"
          style={{ color: branding.colors.textSecondary }}
        >
          Live preview
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {branding.storeNameStyle.showLogo && branding.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo}
              alt=""
              className="h-10 w-10 rounded-md object-contain"
            />
          ) : null}
          <div>
            <p style={previewNameStyle}>{branding.storeNameEn || "Oyon"}</p>
            <p
              className="mt-1 text-sm"
              style={{
                color: branding.colors.textSecondary,
                fontFamily: `"${branding.typography.bodyFont}", sans-serif`,
              }}
            >
              {branding.storeNameAr || "عيون"} · Premium optical
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-xl p-4"
            style={{
              background: branding.colors.card,
              border: `1px solid ${branding.colors.border}`,
            }}
          >
            <p className="text-sm" style={{ color: branding.colors.textSecondary }}>
              Card surface
            </p>
            <p className="mt-1 font-semibold" style={{ color: branding.colors.text }}>
              Eye Exam booking
            </p>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <button
              type="button"
              className="rounded-full px-5 py-3 text-sm font-semibold transition"
              style={{
                background: branding.colors.button,
                color: branding.colors.background,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = branding.colors.buttonHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = branding.colors.button;
              }}
            >
              Book an Appointment
            </button>
            <p className="text-xs" style={{ color: branding.colors.textSecondary }}>
              Accent {branding.colors.primaryAccent} · Gold {branding.colors.gold}
            </p>
          </div>
        </div>
      </div>

      {/* Brand identity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
          Brand
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Store name (English)</label>
            <input
              className="input"
              value={branding.storeNameEn}
              onChange={(e) => patchBranding({ storeNameEn: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Store name (Arabic)</label>
            <input
              className="input"
              dir="rtl"
              value={branding.storeNameAr}
              onChange={(e) => patchBranding({ storeNameAr: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Store name (Hebrew)</label>
            <input
              className="input"
              dir="rtl"
              value={branding.storeNameHe || ""}
              onChange={(e) => patchBranding({ storeNameHe: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Logo URL</label>
            <input
              className="input"
              value={branding.logo || ""}
              onChange={(e) => patchBranding({ logo: e.target.value })}
              placeholder="https://… or upload"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--accent)]">
              <Upload size={15} />
              {uploading === "logo" ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => void onUpload("logo", e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <div>
            <label className="label">Favicon URL</label>
            <input
              className="input"
              value={branding.favicon || ""}
              onChange={(e) => patchBranding({ favicon: e.target.value })}
              placeholder="https://… or upload"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--accent)]">
              <Upload size={15} />
              {uploading === "favicon" ? "Uploading…" : "Upload favicon"}
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
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
          Colors
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField
            label="Primary accent"
            value={branding.colors.primaryAccent}
            onChange={(v) => patchColors("primaryAccent", v)}
          />
          <ColorField
            label="Secondary accent"
            value={branding.colors.secondaryAccent}
            onChange={(v) => patchColors("secondaryAccent", v)}
          />
          <ColorField
            label="Gold"
            value={branding.colors.gold}
            onChange={(v) => patchColors("gold", v)}
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
            label="Text"
            value={branding.colors.text}
            onChange={(v) => patchColors("text", v)}
          />
          <ColorField
            label="Secondary text"
            value={branding.colors.textSecondary}
            onChange={(v) => patchColors("textSecondary", v)}
          />
          <ColorField
            label="Background"
            value={branding.colors.background}
            onChange={(v) => patchColors("background", v)}
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
      </div>

      {/* Typography */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
          Typography
        </h3>
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
      </div>

      {/* Store name styling */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
          Store name styling
        </h3>
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
      </div>
    </section>
  );
}

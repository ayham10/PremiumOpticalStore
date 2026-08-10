"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { useLocale } from "@/components/i18n/LocaleProvider";

const GOLD = "#D4AF37";
const BORDER = "#2A2F36";
const FIELD_BG = "#151A21";
const MUTED = "#8A929C";

type Props = {
  open: boolean;
  onClose: () => void;
};

type AccountUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function AccountSettingsModal({ open, onClose }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess("");
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ user: AccountUser }>("/api/auth/account");
        setName(data.user.name || "");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.account.loadError")
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [open, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError(t("admin.account.nameRequired"));
      return;
    }

    setSaving(true);
    try {
      const data = await apiFetch<{
        user: AccountUser;
        message?: string;
      }>("/api/auth/account", {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() }),
      });
      setSuccess(data.message || t("admin.account.saved"));
      window.dispatchEvent(
        new CustomEvent("oyon:account-updated", { detail: data.user })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.account.saveError")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal open={open} title={t("admin.account.title")} onClose={onClose}>
      {loading ? (
        <p className="m-0 text-sm" style={{ color: MUTED }}>
          {t("admin.account.loading")}
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {error ? (
            <p
              className="rounded-[12px] px-3 py-2 text-sm"
              style={{
                background: "rgba(224,122,122,0.12)",
                border: "1px solid rgba(224,122,122,0.35)",
                color: "#F07178",
              }}
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="rounded-[12px] px-3 py-2 text-sm"
              style={{
                background: "rgba(212,175,55,0.12)",
                border: "1px solid rgba(212,175,55,0.35)",
                color: GOLD,
              }}
            >
              {success}
            </p>
          ) : null}

          <div>
            <label
              className="mb-1.5 block text-[0.78rem] font-medium"
              style={{ color: MUTED }}
              htmlFor="acc-name"
            >
              {t("admin.account.name")}
            </label>
            <input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[12px] px-3 text-[0.9rem] outline-none"
              style={{
                height: 46,
                background: FIELD_BG,
                border: `1px solid ${BORDER}`,
                color: "#FFFFFF",
              }}
              autoComplete="name"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-[12px] text-[0.9rem] font-bold disabled:opacity-50"
            style={{
              height: 48,
              background: GOLD,
              color: "#0B0E14",
              border: "none",
            }}
          >
            {saving ? t("admin.account.saving") : t("admin.account.save")}
          </button>
        </form>
      )}
    </AdminModal>
  );
}

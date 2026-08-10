"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        className="mb-1.5 block text-[0.78rem] font-medium"
        style={{ color: MUTED }}
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-[12px] pe-11 ps-3 text-[0.9rem] outline-none"
          style={{
            height: 46,
            background: FIELD_BG,
            border: `1px solid ${BORDER}`,
            color: "#FFFFFF",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center border-0 bg-transparent"
          style={{ color: GOLD }}
          aria-label={show ? "إخفاء" : "إظهار"}
        >
          {show ? (
            <EyeOff size={16} strokeWidth={1.55} />
          ) : (
            <Eye size={16} strokeWidth={1.55} />
          )}
        </button>
      </div>
    </div>
  );
}

export default function AccountSettingsModal({ open, onClose }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ user: AccountUser }>("/api/auth/account");
        setName(data.user.name || "");
        setEmail(data.user.email || "");
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
    if (!email.trim()) {
      setError(t("admin.account.emailRequired"));
      return;
    }
    if (!currentPassword) {
      setError(t("admin.account.currentRequired"));
      return;
    }
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        setError(t("admin.account.passwordShort"));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t("admin.account.passwordMismatch"));
        return;
      }
    }

    setSaving(true);
    try {
      const data = await apiFetch<{
        user: AccountUser;
        message?: string;
      }>("/api/auth/account", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          currentPassword,
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined,
        }),
      });
      setSuccess(data.message || t("admin.account.saved"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
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

          <div>
            <label
              className="mb-1.5 block text-[0.78rem] font-medium"
              style={{ color: MUTED }}
              htmlFor="acc-email"
            >
              {t("admin.account.email")}
            </label>
            <input
              id="acc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[12px] px-3 text-[0.9rem] outline-none"
              style={{
                height: 46,
                background: FIELD_BG,
                border: `1px solid ${BORDER}`,
                color: "#FFFFFF",
              }}
              autoComplete="username"
              required
              dir="ltr"
            />
          </div>

          <PasswordField
            id="acc-current"
            label={t("admin.account.currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            id="acc-new"
            label={t("admin.account.newPassword")}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            id="acc-confirm"
            label={t("admin.account.confirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-[12px] text-[0.9rem] font-bold disabled:opacity-50"
            style={{
              height: 48,
              background: GOLD,
              color: "#0B0E14",
              border: "none",
              marginTop: 4,
            }}
          >
            {saving ? t("admin.account.saving") : t("admin.account.save")}
          </button>
        </form>
      )}
    </AdminModal>
  );
}

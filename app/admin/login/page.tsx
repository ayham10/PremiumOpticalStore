"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { apiFetch } from "@/lib/admin-api";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="admin-card w-full max-w-md overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="px-8 pb-6 pt-8"
        style={{
          background:
            "linear-gradient(145deg, rgba(212,175,106,0.12) 0%, rgba(19,25,30,0) 55%)",
        }}
      >
        <p className="eyebrow">{t("admin.loginTitle")}</p>
        <div className="mt-2">
          <BrandMark branding={branding} href="/" size="lg" />
        </div>
        <p className="mt-2 text-sm text-[var(--slate)]">{t("admin.loginLead")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 px-8 pb-8">
        <div>
          <label className="label" htmlFor="email">
            {t("admin.email")}
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
            />
            <input
              id="email"
              className="input pl-10"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="password">
            {t("admin.password")}
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
            />
            <input
              id="password"
              className="input pl-10"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-accent w-full"
          disabled={loading}
        >
          {loading ? t("admin.signingIn") : t("admin.signIn")}
        </button>
      </form>
    </motion.div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/admin-api";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState("admin@lumina.optics");
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
            "linear-gradient(145deg, rgba(26,74,107,0.1) 0%, rgba(255,255,255,0) 55%)",
        }}
      >
        <p className="eyebrow">{t("admin.loginTitle")}</p>
        <h1
          className="mt-2 text-3xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {t("admin.brand")}
        </h1>
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
          <p className="rounded-xl bg-[#fdeaea] px-3 py-2 text-sm text-[var(--danger)]">
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

        <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--mist)] px-3 py-3 text-xs text-[var(--slate)]">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--ink-soft)]">
            <Eye size={12} /> {t("admin.demoHint")}
          </p>
        </div>
      </form>
    </motion.div>
  );
}

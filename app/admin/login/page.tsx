"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
      className="admin-login-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="admin-login-brand">
        <p className="admin-login-kicker">{t("admin.loginTitle")}</p>
        <BrandMark branding={branding} href="/" size="lg" />
      </div>

      <form onSubmit={onSubmit} className="admin-login-form">
        <div className="admin-login-field">
          <label className="admin-login-label" htmlFor="email">
            {t("admin.email")}
          </label>
          <div className="admin-login-control">
            <Mail size={16} className="admin-login-icon" />
            <input
              id="email"
              className="admin-login-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="admin-login-field">
          <label className="admin-login-label" htmlFor="password">
            {t("admin.password")}
          </label>
          <div className="admin-login-control">
            <Lock size={16} className="admin-login-icon" />
            <input
              id="password"
              className="admin-login-input has-toggle"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="admin-login-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={1.7} />
              ) : (
                <Eye size={16} strokeWidth={1.7} />
              )}
            </button>
          </div>
        </div>

        {error ? <p className="admin-login-error">{error}</p> : null}

        <button type="submit" className="admin-login-submit" disabled={loading}>
          {loading ? t("admin.signingIn") : t("admin.signIn")}
        </button>
      </form>
    </motion.div>
  );
}

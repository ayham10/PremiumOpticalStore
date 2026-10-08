"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { ApiError, apiFetch } from "@/lib/admin-api";

type StatusPayload = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
};

type ActionPayload = {
  ok: boolean;
  action: "send" | "verify";
  status: string;
  to?: string;
  channel?: string;
  valid?: boolean;
  error?: string;
};

export default function AdminTwilioVerifyOtpTestPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [result, setResult] = useState<ActionPayload | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const data = await apiFetch<StatusPayload>("/api/internal/twilio-verify-otp");
      setStatus(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus({ enabled: false, configured: false, missing: [] });
        return;
      }
      setLoadError(
        err instanceof Error ? err.message : "Could not load the OTP test status.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: "send" | "verify", event: FormEvent) {
    event.preventDefault();
    setBusy(action);
    setActionError("");
    setResult(null);
    try {
      const data = await apiFetch<ActionPayload>("/api/internal/twilio-verify-otp", {
        method: "POST",
        body: JSON.stringify({
          action,
          phone,
          code: action === "verify" ? code : undefined,
        }),
      });
      setResult(data);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "The verification request failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  const blocked = status && !status.enabled;
  const missingVars = status?.missing ?? [];

  return (
    <div className="admin-set" style={{ maxWidth: 640 }}>
      <AdminPageHeader
        icon={ShieldCheck}
        kicker="Development only"
        title="Twilio Verify WhatsApp OTP"
        description="Temporary test to send and confirm a 6-digit WhatsApp code. Blocked in Vercel Production. Does not change booking messages or store data."
      />

      {loadError ? <p className="admin-lens-error">{loadError}</p> : null}

      {blocked ? (
        <section className="admin-card">
          <p>This OTP test is not available in Production.</p>
        </section>
      ) : null}

      {status?.enabled && !status.configured ? (
        <section className="admin-card">
          <h2>Missing server environment variables</h2>
          <p>Set these on the local server, then restart npm run dev:</p>
          <ul>
            {missingVars.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {status?.enabled && status.configured ? (
        <section className="admin-card">
          <form
            className="admin-lens-edit"
            onSubmit={(event) => void run("send", event)}
          >
            <label>
              <span>Phone number</span>
              <input
                className="input"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="052xxxxxxx or +9725xxxxxxxx"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <div className="admin-lens-edit-actions">
              <button
                type="submit"
                className="btn btn-accent"
                disabled={busy !== null}
              >
                {busy === "send" ? "Sending…" : "Send Code"}
              </button>
            </div>
          </form>

          <form
            className="admin-lens-edit"
            style={{ marginTop: "1.25rem" }}
            onSubmit={(event) => void run("verify", event)}
          >
            <label>
              <span>6-digit code</span>
              <input
                className="input"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </label>
            <div className="admin-lens-edit-actions">
              <button
                type="submit"
                className="btn btn-accent"
                disabled={busy !== null}
              >
                {busy === "verify" ? "Verifying…" : "Verify Code"}
              </button>
            </div>
          </form>

          {actionError ? <p className="admin-lens-error">{actionError}</p> : null}

          {result ? (
            <div style={{ marginTop: "1rem" }} dir="ltr">
              <p>
                <strong>{result.ok ? "Success" : "Not verified"}</strong>
              </p>
              <p>Action: {result.action}</p>
              <p>Status: {result.status}</p>
              {result.to ? <p>To: {result.to}</p> : null}
              {result.channel ? <p>Channel: {result.channel}</p> : null}
              {typeof result.valid === "boolean" ? (
                <p>Valid: {result.valid ? "yes" : "no"}</p>
              ) : null}
              {result.error ? <p>{result.error}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, ShieldAlert } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { apiFetch, ApiError } from "@/lib/admin-api";

type TestAppointment = {
  customerName: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  dateLabel?: string;
};

type StatusResponse = {
  allowed?: boolean;
  error?: string;
  vercelEnv?: string | null;
  storageReady?: boolean;
  storeId?: string;
  missing?: string[];
};

type CreateResponse = {
  ok?: boolean;
  manageUrl?: string;
  appointment?: TestAppointment;
  error?: string;
};

export default function BookingManagePreviewTestPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manageUrl, setManageUrl] = useState("");
  const [appointment, setAppointment] = useState<TestAppointment | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    setError("");
    try {
      const data = await apiFetch<StatusResponse>(
        "/api/internal/booking-manage-test",
      );
      setAllowed(Boolean(data.allowed));
      setStorageReady(Boolean(data.storageReady));
      setMissing(data.missing || []);
      if (!data.allowed) {
        setError(data.error || "This booking-manage test is not available in Production.");
      } else if (!data.storageReady) {
        setError(data.error || "Preview test storage is not configured.");
      }
    } catch (err) {
      setAllowed(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not check the Preview test status.",
      );
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function createTestBooking() {
    setBusy(true);
    setError("");
    setCopied(false);
    setManageUrl("");
    setAppointment(null);
    try {
      const data = await apiFetch<CreateResponse>(
        "/api/internal/booking-manage-test",
        { method: "POST" },
      );
      if (!data.manageUrl || !data.appointment) {
        throw new Error(data.error || "Test booking was not created.");
      }
      setManageUrl(data.manageUrl);
      setAppointment(data.appointment);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create a test booking.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!manageUrl) return;
    try {
      await navigator.clipboard.writeText(manageUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="admin-page px-4 py-6 md:px-8">
      <AdminPageHeader
        kicker="Preview only"
        title="Booking management test"
        description="Create an isolated Preview appointment and open its management link. WhatsApp is not sent. Real customer bookings are not used."
        icon={Link2}
      />

      {allowed === false ? (
        <section className="admin-bm-card mt-8" role="status">
          <p className="admin-bm-hint" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldAlert size={18} aria-hidden />
            {error || "This booking-manage test is not available in Production."}
          </p>
        </section>
      ) : allowed && !storageReady ? (
        <section className="admin-bm-card mt-8" role="status">
          <p className="admin-bm-hint" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldAlert size={18} aria-hidden />
            {error}
          </p>
          {missing.length ? (
            <ul className="admin-bm-hint mt-4" dir="ltr">
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
          <p className="admin-bm-hint mt-4">
            Set these on the Vercel Preview environment (not Production). Use store
            row <code>preview_booking_manage_test</code>, never{" "}
            <code>default</code>. Local filesystem storage is not used.
          </p>
        </section>
      ) : (
        <section className="admin-bm-card mt-8">
          <p className="admin-bm-hint">
            The pending Twilio template stays off. The test URL uses this Preview
            domain, not oyonoptics.com. Do not share the link.
          </p>
          <div className="admin-bm-provider-row mt-6">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void createTestBooking()}
              disabled={busy || allowed !== true || !storageReady}
            >
              {busy ? "Creating…" : "Create test appointment"}
            </button>
          </div>
          {error ? (
            <p className="admin-bm-test-result is-error mt-4" role="alert">
              {error}
            </p>
          ) : null}

          {appointment && manageUrl ? (
            <div className="mt-8 space-y-3 text-[var(--ink-soft)]">
              <p>
                <strong className="text-[var(--ink)]">Customer:</strong>{" "}
                {appointment.customerName}
              </p>
              <p>
                <strong className="text-[var(--ink)]">Service:</strong>{" "}
                {appointment.service}
              </p>
              <p>
                <strong className="text-[var(--ink)]">When:</strong>{" "}
                {appointment.dateLabel || appointment.appointmentDate}{" "}
                {appointment.appointmentTime}
              </p>
              <p>
                <strong className="text-[var(--ink)]">Status:</strong>{" "}
                {appointment.status}
              </p>
              <label className="admin-bm-field-label" htmlFor="preview-manage-url">
                Management URL
              </label>
              <input
                id="preview-manage-url"
                className="input admin-bm-input"
                dir="ltr"
                readOnly
                value={manageUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="admin-bm-provider-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void copyUrl()}
                >
                  {copied ? "Copied" : "Copy URL"}
                </button>
                <a
                  className="btn btn-primary"
                  href={manageUrl}
                  rel="noreferrer"
                >
                  Open management page
                </a>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

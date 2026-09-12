"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Clock,
  MessageCircle,
  Phone,
  Plug,
  RefreshCw,
  TriangleAlert,
  Unplug,
  UserRound,
  Zap,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import type { BookingMessagesSettings } from "@/lib/types";

type Props = {
  value: BookingMessagesSettings;
  templates: string[];
  twilioWhatsApp?: {
    configured: boolean;
    from: string | null;
  };
  onChange: (next: BookingMessagesSettings) => void;
};

/** Flip to true to restore Oracle/Meta backup controls in Admin. Logic stays in this file. */
const SHOW_ORACLE_ADMIN_CONTROLS = false;
/** Flip to true to restore editable template name + message body fields. */
const SHOW_EDITABLE_TEMPLATE_CONTROLS = false;

const DISPLAY_CUSTOMER_TEMPLATE = "oyon_booking_confirmation";
const DISPLAY_OWNER_TEMPLATE = "owner_notification";
const DISPLAY_REMINDER_TEMPLATE = "appointment_reminder";

/**
 * Visual-only Admin previews with example values.
 * Never sent to Twilio and not used as ContentVariables.
 */
const TWILIO_CUSTOMER_CONFIRMATION_PREVIEW = `مرحباً محمد 👋

تم تأكيد موعدك في OYON Optics | عيون أوبتيكا

📅 التاريخ: 15/09/2026
🕐 الساعة: 18:30

نتطلع لرؤيتك 💜`;

const TWILIO_OWNER_NOTIFICATION_PREVIEW = `🔔 حجز جديد — OYON Optics

👤 العميل: محمد
📅 التاريخ: 15/09/2026
🕐 الساعة: 18:30
📱 الهاتف: +972501234567
👓 الخدمة: فحص نظر`;

const TWILIO_APPOINTMENT_REMINDER_PREVIEW = `⏰ تذكير بموعدك في OYON Optics | عيون أوبتيكا

مرحباً محمد 👋

📅 التاريخ: 15/09/2026
🕐 الساعة: 18:30
👓 الخدمة: فحص نظر

نتطلع لرؤيتك 💜`;

const REMINDER_MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

function reminderSelectValue(minutesBefore: number): number {
  if (
    (REMINDER_MINUTE_OPTIONS as readonly number[]).includes(minutesBefore)
  ) {
    return minutesBefore;
  }
  const clamped = Math.max(15, Math.min(120, minutesBefore || 60));
  return REMINDER_MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - clamped) < Math.abs(best - clamped) ? option : best,
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="admin-bm-toggle" htmlFor={id}>
      <span className="admin-bm-toggle-label">{label}</span>
      <span className="admin-set-switch admin-bm-switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="admin-set-switch-track" aria-hidden />
      </span>
    </label>
  );
}

function TemplateSelect({
  id,
  label,
  value,
  templates,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  templates: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  const options = [...new Set([value, ...templates].filter(Boolean))];

  return (
    <div className="admin-bm-field">
      <label className="admin-bm-field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select admin-bm-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("admin.settings.bmSelectTemplate")}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <p className="admin-bm-placeholders">{t("admin.settings.bmTemplateHint")}</p>
    </div>
  );
}

function WhatsAppMessagePreview({
  templateName,
  text,
  disabled,
}: {
  templateName: string;
  text: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div
      className={`admin-bm-wa-preview${disabled ? " is-disabled" : ""}`}
    >
      <p className="admin-bm-used-template">
        {t("admin.settings.bmUsedTemplate", { name: templateName })}
      </p>
      <div className="admin-bm-wa-stage">
        <p className="admin-bm-wa-caption">{t("admin.settings.bmMessagePreview")}</p>
        <div className="admin-bm-wa-thread" aria-readonly="true">
          <div className="admin-bm-wa-bubble">
            <p className="admin-bm-wa-text">{text}</p>
          </div>
        </div>
      </div>
      <p className="admin-bm-placeholders">{t("admin.settings.bmPreviewHint")}</p>
    </div>
  );
}

function MessageBodyField({
  id,
  label,
  helper,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  helper: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="admin-bm-field admin-bm-body-field">
      <label className="admin-bm-field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="input admin-bm-input admin-bm-textarea"
        dir="rtl"
        lang="ar"
        rows={10}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="admin-bm-placeholders">{helper}</p>
    </div>
  );
}

export default function BookingMessagesSettingsSection({
  value,
  templates,
  twilioWhatsApp,
  onChange,
}: Props) {
  const { t } = useLocale();
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "reconnect" | "reset" | "disconnect" | null
  >(null);
  const [inflightAction, setInflightAction] = useState<
    "reconnect" | "reset" | "disconnect" | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [serviceStatus, setServiceStatus] = useState<string>("UNCONFIGURED");
  const [serviceReady, setServiceReady] = useState(false);
  const [serviceReachable, setServiceReachable] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrReceivedAt, setQrReceivedAt] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollQrRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyStatus = useCallback(
    (data: {
      status?: string;
      ready?: boolean;
      reachable?: boolean;
      configured?: boolean;
    }) => {
      const status = data.status || "UNAVAILABLE";
      const ready = Boolean(data.ready);
      setServiceStatus(status);
      setServiceReady(ready);
      setServiceReachable(data.reachable !== false && data.configured !== false);
      if (ready) {
        setQrDataUrl(null);
        setQrReceivedAt(null);
        stopPolling();
      }
    },
    [stopPolling],
  );

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{
        ok?: boolean;
        status?: string;
        ready?: boolean;
        reachable?: boolean;
        configured?: boolean;
        lastError?: string | null;
      }>("/api/settings/whatsapp-web/status");
      applyStatus(data);
    } catch {
      setServiceStatus("UNAVAILABLE");
      setServiceReady(false);
      setServiceReachable(false);
      setQrDataUrl(null);
      setQrReceivedAt(null);
    }
  }, [applyStatus]);

  useEffect(() => {
    if (!SHOW_ORACLE_ADMIN_CONTROLS) return;
    void loadStatus();
    startPolling(false);
    return () => stopPolling();
  }, [loadStatus, stopPolling]);

  useEffect(() => {
    if (!SHOW_ORACLE_ADMIN_CONTROLS) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        void loadStatus();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadStatus]);

  async function testOracleConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch<{
        ok: boolean;
        message?: string;
        error?: string;
        status?: string;
        ready?: boolean;
        reachable?: boolean;
        configured?: boolean;
      }>("/api/settings/whatsapp-web/status", { method: "POST" });
      applyStatus(data);
      setTestResult({
        ok: Boolean(data.ok),
        message:
          data.message ||
          (data.ok
            ? t("admin.settings.bmOracleTestSuccess")
            : t("admin.settings.bmOracleTestError")),
      });
    } catch (err) {
      setServiceReachable(false);
      setServiceReady(false);
      setServiceStatus("UNAVAILABLE");
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : t("admin.settings.bmOracleTestError"),
      });
    } finally {
      setTesting(false);
    }
  }

  async function loadQr() {
    const data = await apiFetch<{
      ok?: boolean;
      status?: string;
      ready?: boolean;
      reachable?: boolean;
      configured?: boolean;
      qrDataUrl?: string | null;
      qrReceivedAt?: string | null;
    }>("/api/settings/whatsapp-web/qr");
    applyStatus(data);
    if (data.ready) {
      setQrDataUrl(null);
      setQrReceivedAt(null);
      return data;
    }
    if (data.qrReceivedAt) {
      setQrReceivedAt(data.qrReceivedAt);
    }
    if (data.qrDataUrl) {
      setQrDataUrl(data.qrDataUrl);
    }
    return data;
  }

  function startPolling(includeQr: boolean) {
    stopPolling();
    pollQrRef.current = includeQr;
    pollRef.current = window.setInterval(() => {
      void (pollQrRef.current ? loadQr() : loadStatus());
    }, 4000);
  }

  async function runWhatsAppAdminAction() {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) {
      return;
    }
    setInflightAction(action);
    setResetting(true);
    setTestResult(null);
    const previousReceivedAt = qrReceivedAt;
    try {
      if (action === "disconnect") {
        const data = await apiFetch<{
          ok: boolean;
          status?: string;
          ready?: boolean;
          reachable?: boolean;
          configured?: boolean;
        }>("/api/settings/whatsapp-web/disconnect", { method: "POST" });
        applyStatus({
          status: data.status || "DISCONNECTED",
          ready: false,
          reachable: true,
          configured: true,
        });
        setQrDataUrl(null);
        setQrReceivedAt(null);
        stopPolling();
        await loadStatus();
        return;
      }

      if (action === "reconnect") {
        await apiFetch<{
          ok: boolean;
          status?: string;
          ready?: boolean;
          reachable?: boolean;
          configured?: boolean;
        }>("/api/settings/whatsapp-web/reconnect", { method: "POST" });
      }

      if (action === "reset") {
        await apiFetch<{
          ok: boolean;
          status?: string;
          ready?: boolean;
          reachable?: boolean;
          configured?: boolean;
        }>("/api/settings/whatsapp-web/reset-session", {
          method: "POST",
          body: JSON.stringify({ allowReady: true }),
        });
      }

      applyStatus({
        status: "INITIALIZING",
        ready: false,
        reachable: true,
        configured: true,
      });
      setQrDataUrl(null);
      setQrReceivedAt(null);

      const deadline = Date.now() + 45000;
      let recovered = false;
      while (Date.now() < deadline) {
        const data = await loadQr();
        if (data.ready) {
          recovered = true;
          break;
        }
        if (
          data.status === "QR_REQUIRED" ||
          (data.qrDataUrl &&
            data.qrReceivedAt &&
            data.qrReceivedAt !== previousReceivedAt)
        ) {
          recovered = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      startPolling(true);
      if (!recovered) {
        setTestResult({
          ok: false,
          message: t(
            action === "reset"
              ? "admin.settings.bmOracleLinkNewError"
              : "admin.settings.bmOracleResetError",
          ),
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : t(
                action === "disconnect"
                  ? "admin.settings.bmOracleDisconnectError"
                  : action === "reset"
                    ? "admin.settings.bmOracleLinkNewError"
                    : "admin.settings.bmOracleResetError",
              ),
      });
    } finally {
      setResetting(false);
      setInflightAction(null);
    }
  }

  async function refreshStatus() {
    setRefreshing(true);
    setTestResult(null);
    try {
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  }

  const twilioConfigured = Boolean(twilioWhatsApp?.configured);
  const twilioFrom = twilioWhatsApp?.from?.trim() || "";
  const oracleTone = serviceReady ? "ready" : "idle";
  const oracleLabel = serviceReady
    ? t("admin.settings.bmOracleReady")
    : t("admin.settings.bmOracleBackupIdle");

  return (
    <div className="admin-bm">
      <section className="admin-bm-card">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <Plug className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmProvider")}
          </span>
        </header>
        <div className="admin-bm-field">
          <span className="admin-bm-field-label">{t("admin.settings.bmProviderName")}</span>
          <p className="admin-bm-provider-name">
            {t("admin.settings.bmProviderTwilio")}
          </p>
        </div>
        <div className="admin-bm-status-row" role="status">
          <span
            className={`admin-bm-status-dot is-${twilioConfigured ? "ready" : "unavailable"}`}
            aria-hidden
          />
          <span className="admin-bm-status-label">
            {twilioConfigured
              ? t("admin.settings.bmTwilioActive")
              : t("admin.settings.bmTwilioInactive")}
          </span>
        </div>
        {twilioFrom ? (
          <div className="admin-bm-field">
            <span className="admin-bm-field-label">{t("admin.settings.bmTwilioSender")}</span>
            <p className="admin-bm-provider-name" dir="ltr">
              {twilioFrom}
            </p>
          </div>
        ) : null}
        <p className="admin-bm-hint">{t("admin.settings.bmTwilioHint")}</p>
      </section>

      {SHOW_ORACLE_ADMIN_CONTROLS ? (
      <section className="admin-bm-card admin-bm-card-backup">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <Plug className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmOracleBackup")}
          </span>
        </header>
        <div className="admin-bm-field">
          <span className="admin-bm-field-label">{t("admin.settings.bmProviderName")}</span>
          <p className="admin-bm-provider-name">
            {t("admin.settings.bmProviderOracle")}
          </p>
        </div>
        <p className="admin-bm-hint">{t("admin.settings.bmOracleBackupHint")}</p>
        <div className="admin-bm-status-row" role="status">
          <span className={`admin-bm-status-dot is-${oracleTone}`} aria-hidden />
          <span className="admin-bm-status-label">{oracleLabel}</span>
        </div>
        {!serviceReady ? (
          <p className="admin-bm-hint">
            {serviceReachable
              ? serviceStatus
              : t("admin.settings.bmOracleUnavailable")}
          </p>
        ) : null}
        <div className="admin-bm-provider-row">
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => void testOracleConnection()}
            disabled={testing}
          >
            <Zap size={14} strokeWidth={1.75} aria-hidden />
            {testing
              ? t("admin.settings.bmOracleTesting")
              : t("admin.settings.bmOracleTest")}
          </button>
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => void refreshStatus()}
            disabled={refreshing}
          >
            <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
            {refreshing
              ? t("admin.settings.bmOracleRefreshing")
              : t("admin.settings.bmOracleRefresh")}
          </button>
          {serviceReady ? (
            <button
              type="button"
              className="btn btn-ghost admin-bm-test-btn admin-bm-danger-btn"
              onClick={() => setConfirmAction("disconnect")}
              disabled={resetting}
            >
              <Unplug size={14} strokeWidth={1.75} aria-hidden />
              {resetting
                ? t("admin.settings.bmOracleDisconnectLoading")
                : t("admin.settings.bmOracleDisconnect")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost admin-bm-test-btn"
              onClick={() => setConfirmAction("reconnect")}
              disabled={resetting}
            >
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
              {resetting
                ? t("admin.settings.bmOracleResetLoading")
                : t("admin.settings.bmOracleReset")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn admin-bm-danger-btn"
            onClick={() => setConfirmAction("reset")}
            disabled={resetting}
          >
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />
            {resetting
              ? t("admin.settings.bmOracleLinkNewLoading")
              : t("admin.settings.bmOracleLinkNew")}
          </button>
        </div>
        {testResult ? (
          <p
            className={`admin-bm-test-result${testResult.ok ? " is-success" : " is-error"}`}
            role="status"
          >
            {testResult.message}
          </p>
        ) : null}
        {resetting && !qrDataUrl ? (
          <p className="admin-bm-hint">
            {inflightAction === "disconnect"
              ? t("admin.settings.bmOracleDisconnectLoading")
              : inflightAction === "reset"
                ? t("admin.settings.bmOracleLinkNewLoading")
                : t("admin.settings.bmOracleResetLoading")}
          </p>
        ) : null}
        {qrDataUrl && !serviceReady ? (
          <div className="admin-bm-qr">
            <p className="admin-bm-hint">{t("admin.settings.bmOracleQrHint")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={t("admin.settings.bmOracleQrAlt")}
              width={280}
              height={280}
              className="admin-bm-qr-image"
            />
          </div>
        ) : null}
        <p className="admin-bm-hint">{t("admin.settings.bmOracleHint")}</p>
      </section>
      ) : null}

      {SHOW_ORACLE_ADMIN_CONTROLS ? (
      <AdminModal
        open={confirmAction !== null}
        title={
          confirmAction === "disconnect"
            ? t("admin.settings.bmOracleDisconnectTitle")
            : confirmAction === "reset"
              ? t("admin.settings.bmOracleLinkNewTitle")
              : t("admin.settings.bmOracleResetTitle")
        }
        onClose={() => {
          if (!resetting) setConfirmAction(null);
        }}
        icon={<TriangleAlert className="admin-bm-gold-icon" size={18} aria-hidden />}
      >
        <p className="admin-bm-hint" style={{ maxWidth: "100%", marginBottom: "1rem" }}>
          {confirmAction === "disconnect"
            ? t("admin.settings.bmOracleDisconnectConfirm")
            : confirmAction === "reset"
              ? t("admin.settings.bmOracleLinkNewConfirm")
              : t("admin.settings.bmOracleResetConfirm")}
        </p>
        <div className="admin-bm-provider-row">
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => setConfirmAction(null)}
            disabled={resetting}
          >
            {t("admin.settings.bmOracleResetCancel")}
          </button>
          <button
            type="button"
            className={`btn btn-ghost admin-bm-test-btn${
              confirmAction === "disconnect" || confirmAction === "reset"
                ? " admin-bm-danger-btn"
                : ""
            }`}
            onClick={() => void runWhatsAppAdminAction()}
            disabled={resetting}
          >
            {confirmAction === "disconnect"
              ? t("admin.settings.bmOracleDisconnectConfirmAction")
              : confirmAction === "reset"
                ? t("admin.settings.bmOracleLinkNewConfirmAction")
                : t("admin.settings.bmOracleResetConfirmAction")}
          </button>
        </div>
      </AdminModal>
      ) : null}

      <section className="admin-bm-card">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <MessageCircle className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmCustomer")}
          </span>
          <ToggleRow
            id="bm-customer-enabled"
            label={t("admin.settings.bmEnabled")}
            checked={value.customerConfirmation.enabled}
            onChange={(enabled) =>
              onChange({
                ...value,
                customerConfirmation: { ...value.customerConfirmation, enabled },
              })
            }
          />
        </header>
        <p className="admin-bm-hint">{t("admin.settings.bmViaTwilio")}</p>
        {SHOW_EDITABLE_TEMPLATE_CONTROLS ? (
          <>
            <TemplateSelect
              id="bm-customer-template"
              label={t("admin.settings.bmTemplate")}
              value={value.customerConfirmation.templateName}
              templates={templates}
              disabled={!value.customerConfirmation.enabled}
              onChange={(templateName) =>
                onChange({
                  ...value,
                  customerConfirmation: { ...value.customerConfirmation, templateName },
                })
              }
            />
            <MessageBodyField
              id="bm-customer-body"
              label={t("admin.settings.bmMessageBody")}
              helper={t("admin.settings.bmPlaceholders")}
              value={value.customerConfirmation.body}
              disabled={!value.customerConfirmation.enabled}
              onChange={(body) =>
                onChange({
                  ...value,
                  customerConfirmation: { ...value.customerConfirmation, body },
                })
              }
            />
          </>
        ) : (
          <WhatsAppMessagePreview
            templateName={DISPLAY_CUSTOMER_TEMPLATE}
            text={TWILIO_CUSTOMER_CONFIRMATION_PREVIEW}
            disabled={!value.customerConfirmation.enabled}
          />
        )}
      </section>

      <section className="admin-bm-card">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <UserRound className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmOwner")}
          </span>
          <ToggleRow
            id="bm-owner-enabled"
            label={t("admin.settings.bmEnabled")}
            checked={value.ownerNotification.enabled}
            onChange={(enabled) =>
              onChange({
                ...value,
                ownerNotification: { ...value.ownerNotification, enabled },
              })
            }
          />
        </header>
        <p className="admin-bm-hint">{t("admin.settings.bmViaTwilio")}</p>
        <div className="admin-bm-fields">
          <div className="admin-bm-field">
            <label className="admin-bm-field-label" htmlFor="bm-owner-phone">
              <Phone className="admin-bm-gold-icon" size={14} strokeWidth={1.75} aria-hidden />
              {t("admin.settings.bmOwnerPhone")}
            </label>
            <input
              id="bm-owner-phone"
              className="input admin-bm-input"
              dir="ltr"
              inputMode="tel"
              placeholder="972521234567"
              value={value.ownerNotification.ownerWhatsApp}
              disabled={!value.ownerNotification.enabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  ownerNotification: {
                    ...value.ownerNotification,
                    ownerWhatsApp: e.target.value,
                  },
                })
              }
            />
          </div>
          {SHOW_EDITABLE_TEMPLATE_CONTROLS ? (
            <TemplateSelect
              id="bm-owner-template"
              label={t("admin.settings.bmTemplate")}
              value={value.ownerNotification.templateName}
              templates={templates}
              disabled={!value.ownerNotification.enabled}
              onChange={(templateName) =>
                onChange({
                  ...value,
                  ownerNotification: { ...value.ownerNotification, templateName },
                })
              }
            />
          ) : null}
        </div>
        {SHOW_EDITABLE_TEMPLATE_CONTROLS ? (
          <MessageBodyField
            id="bm-owner-body"
            label={t("admin.settings.bmMessageBody")}
            helper={t("admin.settings.bmPlaceholders")}
            value={value.ownerNotification.body}
            disabled={!value.ownerNotification.enabled}
            onChange={(body) =>
              onChange({
                ...value,
                ownerNotification: { ...value.ownerNotification, body },
              })
            }
          />
        ) : (
          <WhatsAppMessagePreview
            templateName={DISPLAY_OWNER_TEMPLATE}
            text={TWILIO_OWNER_NOTIFICATION_PREVIEW}
            disabled={!value.ownerNotification.enabled}
          />
        )}
      </section>

      <section className="admin-bm-card">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <Bell className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmReminder")}
          </span>
          <ToggleRow
            id="bm-reminder-enabled"
            label={t("admin.settings.bmEnabled")}
            checked={value.appointmentReminder.enabled}
            onChange={(enabled) =>
              onChange({
                ...value,
                appointmentReminder: { ...value.appointmentReminder, enabled },
              })
            }
          />
        </header>
        <p className="admin-bm-hint">{t("admin.settings.bmViaTwilio")}</p>
        <div className="admin-bm-fields">
          <div className="admin-bm-field">
            <label className="admin-bm-field-label" htmlFor="bm-reminder-minutes">
              <Clock className="admin-bm-gold-icon" size={14} strokeWidth={1.75} aria-hidden />
              {t("admin.settings.bmReminderTime")}
            </label>
            <select
              id="bm-reminder-minutes"
              className="select admin-bm-select"
              value={reminderSelectValue(value.appointmentReminder.minutesBefore)}
              disabled={!value.appointmentReminder.enabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  appointmentReminder: {
                    ...value.appointmentReminder,
                    minutesBefore: Number(e.target.value) as (typeof REMINDER_MINUTE_OPTIONS)[number],
                  },
                })
              }
            >
              {REMINDER_MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t(`admin.settings.bmReminderMin${minutes}`)}
                </option>
              ))}
            </select>
          </div>
          {SHOW_EDITABLE_TEMPLATE_CONTROLS ? (
            <TemplateSelect
              id="bm-reminder-template"
              label={t("admin.settings.bmTemplate")}
              value={value.appointmentReminder.templateName}
              templates={templates}
              disabled={!value.appointmentReminder.enabled}
              onChange={(templateName) =>
                onChange({
                  ...value,
                  appointmentReminder: { ...value.appointmentReminder, templateName },
                })
              }
            />
          ) : null}
        </div>
        {SHOW_EDITABLE_TEMPLATE_CONTROLS ? (
          <MessageBodyField
            id="bm-reminder-body"
            label={t("admin.settings.bmMessageBody")}
            helper={t("admin.settings.bmPlaceholders")}
            value={value.appointmentReminder.body}
            disabled={!value.appointmentReminder.enabled}
            onChange={(body) =>
              onChange({
                ...value,
                appointmentReminder: { ...value.appointmentReminder, body },
              })
            }
          />
        ) : (
          <WhatsAppMessagePreview
            templateName={DISPLAY_REMINDER_TEMPLATE}
            text={TWILIO_APPOINTMENT_REMINDER_PREVIEW}
            disabled={!value.appointmentReminder.enabled}
          />
        )}
      </section>
    </div>
  );
}

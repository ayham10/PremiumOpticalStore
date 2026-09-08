"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Clock,
  MessageCircle,
  Phone,
  Plug,
  QrCode,
  RefreshCw,
  RotateCw,
  TriangleAlert,
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
  onChange: (next: BookingMessagesSettings) => void;
};

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
  onChange,
}: Props) {
  const { t } = useLocale();
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
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
    void loadStatus();
    return () => stopPolling();
  }, [loadStatus, stopPolling]);

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

  async function connectWhatsApp() {
    setConnecting(true);
    setTestResult(null);
    try {
      await loadQr();
      startPolling(true);
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : t("admin.settings.bmOracleQrError"),
      });
    } finally {
      setConnecting(false);
    }
  }

  async function generateFreshQr() {
    setReconnecting(true);
    setTestResult(null);
    const previousReceivedAt = qrReceivedAt;
    try {
      await apiFetch<{
        ok: boolean;
        status?: string;
        ready?: boolean;
        reachable?: boolean;
        configured?: boolean;
      }>("/api/settings/whatsapp-web/reconnect", { method: "POST" });
      applyStatus({
        status: "INITIALIZING",
        ready: false,
        reachable: true,
        configured: true,
      });
      setQrDataUrl(null);
      setQrReceivedAt(null);

      const deadline = Date.now() + 45000;
      let foundFreshQr = false;
      while (Date.now() < deadline) {
        const data = await loadQr();
        if (data.ready) {
          foundFreshQr = true;
          break;
        }
        if (
          data.qrDataUrl &&
          data.qrReceivedAt &&
          data.qrReceivedAt !== previousReceivedAt
        ) {
          foundFreshQr = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      startPolling(true);
      if (!foundFreshQr) {
        setTestResult({
          ok: false,
          message: t("admin.settings.bmOracleFreshQrError"),
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : t("admin.settings.bmOracleFreshQrError"),
      });
    } finally {
      setReconnecting(false);
    }
  }

  async function resetWhatsAppSession() {
    setResetConfirmOpen(false);
    setResetting(true);
    setTestResult(null);
    const previousReceivedAt = qrReceivedAt;
    try {
      await apiFetch<{
        ok: boolean;
        status?: string;
        ready?: boolean;
        reachable?: boolean;
        configured?: boolean;
      }>("/api/settings/whatsapp-web/reset-session", { method: "POST" });
      applyStatus({
        status: "INITIALIZING",
        ready: false,
        reachable: true,
        configured: true,
      });
      setQrDataUrl(null);
      setQrReceivedAt(null);

      const deadline = Date.now() + 45000;
      let foundFreshQr = false;
      while (Date.now() < deadline) {
        const data = await loadQr();
        if (data.ready) {
          foundFreshQr = true;
          break;
        }
        if (
          data.qrDataUrl &&
          data.qrReceivedAt &&
          data.qrReceivedAt !== previousReceivedAt
        ) {
          foundFreshQr = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      startPolling(true);
      if (!foundFreshQr) {
        setTestResult({
          ok: false,
          message: t("admin.settings.bmOracleResetError"),
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : t("admin.settings.bmOracleResetError"),
      });
    } finally {
      setResetting(false);
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

  const statusTone = !serviceReachable
    ? "unavailable"
    : serviceReady
      ? "ready"
      : serviceStatus === "DISCONNECTED" || serviceStatus === "AUTH_FAILURE"
        ? "down"
        : "wait";

  const statusLabel =
    statusTone === "ready"
      ? t("admin.settings.bmOracleReady")
      : statusTone === "wait"
        ? t("admin.settings.bmOracleWaiting")
        : statusTone === "down"
          ? t("admin.settings.bmOracleDisconnected")
          : t("admin.settings.bmOracleUnavailable");

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
            {t("admin.settings.bmProviderOracle")}
          </p>
        </div>
        <div className="admin-bm-status-row" role="status">
          <span className={`admin-bm-status-dot is-${statusTone}`} aria-hidden />
          <span className="admin-bm-status-label">{statusLabel}</span>
        </div>
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
          {!serviceReady ? (
            <>
              <button
                type="button"
                className="btn btn-ghost admin-bm-test-btn"
                onClick={() => void connectWhatsApp()}
                disabled={connecting || reconnecting || resetting}
              >
                <QrCode size={14} strokeWidth={1.75} aria-hidden />
                {connecting
                  ? t("admin.settings.bmOracleConnecting")
                  : t("admin.settings.bmOracleConnect")}
              </button>
              <button
                type="button"
                className="btn btn-ghost admin-bm-test-btn"
                onClick={() => void generateFreshQr()}
                disabled={reconnecting || connecting || resetting}
              >
                <RotateCw size={14} strokeWidth={1.75} aria-hidden />
                {reconnecting
                  ? t("admin.settings.bmOracleFreshQrLoading")
                  : t("admin.settings.bmOracleFreshQr")}
              </button>
              <button
                type="button"
                className="btn btn-ghost admin-bm-test-btn"
                onClick={() => setResetConfirmOpen(true)}
                disabled={reconnecting || connecting || resetting}
              >
                <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />
                {resetting
                  ? t("admin.settings.bmOracleResetLoading")
                  : t("admin.settings.bmOracleReset")}
              </button>
            </>
          ) : null}
        </div>
        {testResult ? (
          <p
            className={`admin-bm-test-result${testResult.ok ? " is-success" : " is-error"}`}
            role="status"
          >
            {testResult.message}
          </p>
        ) : null}
        {(reconnecting || resetting) && !qrDataUrl ? (
          <p className="admin-bm-hint">
            {resetting
              ? t("admin.settings.bmOracleResetLoading")
              : t("admin.settings.bmOracleFreshQrLoading")}
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

      <AdminModal
        open={resetConfirmOpen}
        title={t("admin.settings.bmOracleResetTitle")}
        onClose={() => {
          if (!resetting) setResetConfirmOpen(false);
        }}
        icon={<TriangleAlert className="admin-bm-gold-icon" size={18} aria-hidden />}
      >
        <p className="admin-bm-hint" style={{ maxWidth: "100%", marginBottom: "1rem" }}>
          {t("admin.settings.bmOracleResetConfirm")}
        </p>
        <div className="admin-bm-provider-row">
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => setResetConfirmOpen(false)}
            disabled={resetting}
          >
            {t("admin.settings.bmOracleResetCancel")}
          </button>
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => void resetWhatsAppSession()}
            disabled={resetting}
          >
            {t("admin.settings.bmOracleResetConfirmAction")}
          </button>
        </div>
      </AdminModal>

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
        </div>
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
        <div className="admin-bm-fields">
          <div className="admin-bm-field">
            <label className="admin-bm-field-label" htmlFor="bm-reminder-hours">
              <Clock className="admin-bm-gold-icon" size={14} strokeWidth={1.75} aria-hidden />
              {t("admin.settings.bmHoursBefore")}
            </label>
            <input
              id="bm-reminder-hours"
              type="number"
              min={1}
              max={168}
              className="input admin-bm-input admin-bm-input-narrow"
              value={value.appointmentReminder.hoursBefore}
              disabled={!value.appointmentReminder.enabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  appointmentReminder: {
                    ...value.appointmentReminder,
                    hoursBefore: Math.max(1, Number(e.target.value) || 1),
                  },
                })
              }
            />
          </div>
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
        </div>
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
      </section>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Clock,
  Phone,
  Plug,
  RefreshCw,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import {
  maskWhatsAppDestination,
  resolveOwnerNotificationDestination,
} from "@/lib/booking-messages";
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
const TEMPLATE_BOOKING_HE = "oyon_booking_manage_v2_he";
const TEMPLATE_BOOKING_AR = "oyon_booking_manage_v2_ar";
const TEMPLATE_OWNER_RESCHEDULED = "oyon_booking_rescheduled_owner";
const TEMPLATE_OWNER_CANCELLED = "oyon_booking_cancelled_owner";
const ENV_BOOKING_HE = "TWILIO_TEMPLATE_BOOKING_HE";
const ENV_BOOKING_AR = "TWILIO_TEMPLATE_BOOKING_AR";
const ENV_OWNER_RESCHEDULED = "TWILIO_TEMPLATE_OWNER_RESCHEDULED";
const ENV_OWNER_CANCELLED = "TWILIO_TEMPLATE_OWNER_CANCELLED";

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

const TWILIO_BOOKING_HE_PREVIEW = `שלום דנה 👋

התור שלך ב-OYON Optics | עיון אופטיקה אושר

📅 תאריך: 15/10/2026
🕐 שעה: 18:30

https://oyonoptics.com/booking/manage/{{5}}`;

const TWILIO_BOOKING_AR_PREVIEW = `مرحباً محمد 👋

تم تأكيد موعدك في OYON Optics | عيون أوبتيكا

📅 التاريخ: 15/10/2026
🕐 الساعة: 18:30

https://oyonoptics.com/booking/manage/{{5}}`;

const TWILIO_OWNER_RESCHEDULED_PREVIEW = `🔔 تم تغيير الموعد — OYON Optics

👤 العميل: محمد علي
📱 الهاتف: +972501234567
👓 الخدمة: فحص نظر
📅 من: 15/10/2026 10:30
📅 إلى: 16/10/2026 11:00`;

const TWILIO_OWNER_CANCELLED_PREVIEW = `🔔 تم إلغاء الموعد — OYON Optics

👤 العميل: محمد علي
📅 التاريخ: 15/10/2026
🕐 الساعة: 10:30
📱 الهاتف: +972501234567
👓 الخدمة: فحص نظر`;

const REMINDER_MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

type AccordionId =
  | "provider"
  | "customer"
  | "bookingHe"
  | "bookingAr"
  | "owner"
  | "ownerRescheduled"
  | "ownerCancelled"
  | "reminder";

function AccordionCard({
  id,
  title,
  statusLabel,
  statusTone = "idle",
  open,
  onToggle,
  children,
}: {
  id: AccordionId;
  title: string;
  statusLabel: string;
  statusTone?: "on" | "off" | "ready" | "idle";
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={`admin-bm-card admin-bm-acc-card${open ? " is-open" : ""}`}
    >
      <h3 className="admin-bm-acc-heading">
        <button
          type="button"
          id={`bm-${id}-header`}
          className="admin-bm-acc-head"
          aria-expanded={open}
          aria-controls={`bm-${id}-panel`}
          onClick={onToggle}
        >
          <span className="admin-bm-acc-title">{title}</span>
          <span className="admin-bm-acc-meta">
            <span className={`admin-bm-acc-status is-${statusTone}`}>
              {statusLabel}
            </span>
            <ChevronDown
              className="admin-bm-acc-chevron"
              size={18}
              strokeWidth={1.75}
              aria-hidden
            />
          </span>
        </button>
      </h3>
      {open ? (
        <div
          id={`bm-${id}-panel`}
          role="region"
          aria-labelledby={`bm-${id}-header`}
          className="admin-bm-acc-body"
        >
          <div className="admin-bm-acc-body-inner">{children}</div>
        </div>
      ) : null}
    </section>
  );
}

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
  lang = "ar",
}: {
  templateName: string;
  text: string;
  disabled?: boolean;
  lang?: "ar" | "he";
}) {
  const { t } = useLocale();

  return (
    <div
      className={`admin-bm-wa-preview${disabled ? " is-disabled" : ""}`}
      dir="rtl"
    >
      <p className="admin-bm-used-template">
        {t("admin.settings.bmUsedTemplate", { name: templateName })}
      </p>
      <div className="admin-bm-wa-stage">
        <p className="admin-bm-wa-caption">{t("admin.settings.bmMessagePreview")}</p>
        <div
          className="admin-bm-wa-thread"
          dir="rtl"
          lang={lang}
          aria-readonly="true"
        >
          <div className="admin-bm-wa-bubble">
            <p className="admin-bm-wa-text" dir="rtl" lang={lang}>
              {text}
            </p>
          </div>
        </div>
      </div>
      <p className="admin-bm-placeholders">{t("admin.settings.bmPreviewHint")}</p>
    </div>
  );
}

function ApprovedTemplateDetails({
  templateName,
  envName,
  language,
  configured,
  enabled,
  previewText,
  previewLang = "ar",
}: {
  templateName: string;
  envName: string;
  language: string;
  configured: boolean;
  enabled: boolean;
  previewText: string;
  previewLang?: "ar" | "he";
}) {
  const { t } = useLocale();
  return (
    <>
      <dl className="admin-bm-meta-list">
        <div>
          <dt>{t("admin.settings.bmTemplate")}</dt>
          <dd dir="ltr">{templateName}</dd>
        </div>
        <div>
          <dt>{t("admin.settings.bmTemplateLanguage")}</dt>
          <dd>{language}</dd>
        </div>
        <div>
          <dt>{t("admin.settings.bmConfigStatus")}</dt>
          <dd>
            {configured
              ? t("admin.settings.bmConfigured")
              : t("admin.settings.bmNotConfigured")}
          </dd>
        </div>
        <div>
          <dt>{t("admin.settings.bmNotificationState")}</dt>
          <dd>
            {enabled
              ? t("admin.settings.bmEnabled")
              : t("admin.settings.bmInactive")}
          </dd>
        </div>
        <div>
          <dt>{t("admin.settings.bmServerVariable")}</dt>
          <dd dir="ltr">{envName}</dd>
        </div>
      </dl>
      <p className="admin-bm-hint">{t("admin.settings.bmEnvManagedHint")}</p>
      <WhatsAppMessagePreview
        templateName={templateName}
        text={previewText}
        disabled={!enabled || !configured}
        lang={previewLang}
      />
    </>
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
  const [twilioHealth, setTwilioHealth] = useState<
    "checking" | "connected" | "issue" | "unconfigured"
  >("checking");
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
  const [openCard, setOpenCard] = useState<AccordionId | null>(null);
  const [templateConfigured, setTemplateConfigured] = useState<
    Record<string, boolean>
  >({});

  function toggleCard(id: AccordionId) {
    setOpenCard((current) => (current === id ? null : id));
  }

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

  const twilioFrom = twilioWhatsApp?.from?.trim() || "";
  const checkTwilioHealth = useCallback(async () => {
    setTwilioHealth("checking");
    try {
      const data = await apiFetch<{
        configured?: boolean;
        connected?: boolean;
        from?: string | null;
      }>("/api/settings/twilio/status");
      if (!data.configured) {
        setTwilioHealth("unconfigured");
        return;
      }
      setTwilioHealth(data.connected ? "connected" : "issue");
    } catch {
      setTwilioHealth("issue");
    }
  }, []);

  useEffect(() => {
    void checkTwilioHealth();
  }, [checkTwilioHealth]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{
      templates?: Record<string, { configured?: boolean }>;
    }>("/api/settings/twilio/templates")
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const [name, info] of Object.entries(data.templates || {})) {
          next[name] = info?.configured === true;
        }
        setTemplateConfigured(next);
      })
      .catch(() => {
        if (!cancelled) setTemplateConfigured({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const twilioTone =
    twilioHealth === "connected"
      ? "ready"
      : twilioHealth === "issue"
        ? "down"
        : twilioHealth === "checking"
          ? "wait"
          : "idle";
  const twilioHealthLabel =
    twilioHealth === "connected"
      ? t("admin.settings.bmTwilioConnected")
      : twilioHealth === "issue"
        ? t("admin.settings.bmTwilioConnectionIssue")
        : twilioHealth === "checking"
          ? t("admin.settings.bmTwilioChecking")
          : t("admin.settings.bmTwilioNotConfigured");
  const oracleTone = serviceReady ? "ready" : "idle";
  const oracleLabel = serviceReady
    ? t("admin.settings.bmOracleReady")
    : t("admin.settings.bmOracleBackupIdle");

  const providerConnected = twilioHealth === "connected";
  const providerStatusLabel = providerConnected
    ? t("admin.settings.bmTwilioConnected")
    : t("admin.settings.bmDisconnected");
  const confirmationMode =
    value.customerConfirmation.confirmationMode === "new" ? "new" : "original";
  const ownerTestActive = value.ownerNotification.testDestinationEnabled === true;
  const ownerDestination = resolveOwnerNotificationDestination(value);
  const ownerDestinationLabel =
    ownerDestination.source === "test"
      ? t("admin.settings.bmOwnerDestinationTest")
      : ownerDestination.source === "business"
        ? t("admin.settings.bmOwnerDestinationBusiness")
        : ownerTestActive
          ? t("admin.settings.bmOwnerTestInvalid")
          : t("admin.settings.bmOwnerDestinationBusiness");
  const ownerDestinationMask = maskWhatsAppDestination(ownerDestination.to);

  return (
    <div className="admin-bm">
      {ownerTestActive ? (
        <p className="admin-bm-test-banner" role="status">
          {t("admin.settings.bmOwnerTestBanner")}
          {ownerDestinationMask ? ` (${ownerDestinationMask})` : ""}
        </p>
      ) : null}
      <AccordionCard
        id="provider"
        title={t("admin.settings.bmProvider")}
        statusLabel={providerStatusLabel}
        statusTone={providerConnected ? "ready" : "idle"}
        open={openCard === "provider"}
        onToggle={() => toggleCard("provider")}
      >
        <div className="admin-bm-field">
          <span className="admin-bm-field-label">{t("admin.settings.bmProviderName")}</span>
          <p className="admin-bm-provider-name">
            {t("admin.settings.bmProviderTwilio")}
          </p>
        </div>
        <div className="admin-bm-status-row" role="status">
          <span
            className={`admin-bm-status-dot is-${twilioTone}`}
            aria-hidden
          />
          <span className="admin-bm-status-label">{twilioHealthLabel}</span>
        </div>
        <div className="admin-bm-provider-row">
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => void checkTwilioHealth()}
            disabled={twilioHealth === "checking"}
          >
            <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
            {twilioHealth === "checking"
              ? t("admin.settings.bmTwilioRefreshing")
              : t("admin.settings.bmTwilioRefresh")}
          </button>
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
      </AccordionCard>

      <div className="admin-bm-card admin-bm-mode">
        <span className="admin-bm-field-label">
          {t("admin.settings.bmConfirmationMode")}
        </span>
        <div className="admin-bm-mode-switch" role="radiogroup" aria-label={t("admin.settings.bmConfirmationMode")}>
          <button
            type="button"
            role="radio"
            aria-checked={confirmationMode === "original"}
            onClick={() =>
              onChange({
                ...value,
                customerConfirmation: {
                  ...value.customerConfirmation,
                  confirmationMode: "original",
                },
              })
            }
          >
            {t("admin.settings.bmModeOriginal")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={confirmationMode === "new"}
            onClick={() =>
              onChange({
                ...value,
                customerConfirmation: {
                  ...value.customerConfirmation,
                  confirmationMode: "new",
                },
              })
            }
          >
            {t("admin.settings.bmModeNew")}
          </button>
        </div>
        <p className="admin-bm-hint">
          {confirmationMode === "new"
            ? t("admin.settings.bmModeNewHint")
            : t("admin.settings.bmModeOriginalHint")}
        </p>
        <p className="admin-bm-hint">{t("admin.settings.bmModeSaveHint")}</p>
      </div>

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

      <AccordionCard
        id="customer"
        title={t("admin.settings.bmCustomer")}
        statusLabel={
          value.customerConfirmation.enabled
            ? t("admin.settings.bmEnabled")
            : t("admin.settings.bmInactive")
        }
        statusTone={value.customerConfirmation.enabled ? "on" : "off"}
        open={openCard === "customer"}
        onToggle={() => toggleCard("customer")}
      >
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
      </AccordionCard>

      <AccordionCard
        id="bookingHe"
        title={t("admin.settings.bmBookingHe")}
        statusLabel={
          templateConfigured[TEMPLATE_BOOKING_HE]
            ? t("admin.settings.bmConfigured")
            : t("admin.settings.bmNotConfigured")
        }
        statusTone={templateConfigured[TEMPLATE_BOOKING_HE] ? "ready" : "idle"}
        open={openCard === "bookingHe"}
        onToggle={() => toggleCard("bookingHe")}
      >
        <ApprovedTemplateDetails
          templateName={TEMPLATE_BOOKING_HE}
          envName={ENV_BOOKING_HE}
          language={t("admin.settings.bmLanguageHe")}
          configured={Boolean(templateConfigured[TEMPLATE_BOOKING_HE])}
          enabled={value.customerConfirmation.enabled}
          previewText={TWILIO_BOOKING_HE_PREVIEW}
          previewLang="he"
        />
      </AccordionCard>

      <AccordionCard
        id="bookingAr"
        title={t("admin.settings.bmBookingAr")}
        statusLabel={
          templateConfigured[TEMPLATE_BOOKING_AR]
            ? t("admin.settings.bmConfigured")
            : t("admin.settings.bmNotConfigured")
        }
        statusTone={templateConfigured[TEMPLATE_BOOKING_AR] ? "ready" : "idle"}
        open={openCard === "bookingAr"}
        onToggle={() => toggleCard("bookingAr")}
      >
        <ApprovedTemplateDetails
          templateName={TEMPLATE_BOOKING_AR}
          envName={ENV_BOOKING_AR}
          language={t("admin.settings.bmLanguageAr")}
          configured={Boolean(templateConfigured[TEMPLATE_BOOKING_AR])}
          enabled={value.customerConfirmation.enabled}
          previewText={TWILIO_BOOKING_AR_PREVIEW}
        />
      </AccordionCard>

      <AccordionCard
        id="owner"
        title={t("admin.settings.bmOwner")}
        statusLabel={
          ownerTestActive
            ? t("admin.settings.bmOwnerTestActive")
            : value.ownerNotification.enabled
              ? t("admin.settings.bmEnabled")
              : t("admin.settings.bmInactive")
        }
        statusTone={ownerTestActive ? "off" : value.ownerNotification.enabled ? "on" : "off"}
        open={openCard === "owner"}
        onToggle={() => toggleCard("owner")}
      >
        {ownerTestActive ? (
          <p className="admin-bm-test-banner" role="status">
            {t("admin.settings.bmOwnerTestBanner")}
          </p>
        ) : null}
        <p className="admin-bm-hint" role="status">
          {ownerDestinationLabel}
          {ownerDestinationMask ? ` (${ownerDestinationMask})` : ""}
        </p>
        {ownerTestActive && ownerDestination.source !== "test" ? (
          <p className="admin-bm-test-banner" role="status">
            {t("admin.settings.bmOwnerTestInvalid")}
          </p>
        ) : null}
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
          <ToggleRow
            id="bm-owner-test-enabled"
            label={t("admin.settings.bmOwnerTestEnable")}
            checked={ownerTestActive}
            onChange={(testDestinationEnabled) =>
              onChange({
                ...value,
                ownerNotification: {
                  ...value.ownerNotification,
                  testDestinationEnabled,
                },
              })
            }
          />
          <div className="admin-bm-field">
            <label className="admin-bm-field-label" htmlFor="bm-owner-test-phone">
              {t("admin.settings.bmOwnerTestPhone")}
            </label>
            <input
              id="bm-owner-test-phone"
              className="input admin-bm-input"
              dir="ltr"
              inputMode="tel"
              placeholder="972501234567"
              value={value.ownerNotification.testWhatsApp || ""}
              disabled={!value.ownerNotification.enabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  ownerNotification: {
                    ...value.ownerNotification,
                    testWhatsApp: e.target.value,
                  },
                })
              }
            />
            <p className="admin-bm-placeholders">
              {t("admin.settings.bmOwnerTestHint")}
            </p>
          </div>
          {ownerTestActive ? (
            <button
              type="button"
              className="btn btn-ghost admin-bm-test-btn"
              onClick={() =>
                onChange({
                  ...value,
                  ownerNotification: {
                    ...value.ownerNotification,
                    testDestinationEnabled: false,
                  },
                })
              }
            >
              {t("admin.settings.bmOwnerTestRestore")}
            </button>
          ) : null}
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
      </AccordionCard>

      <AccordionCard
        id="ownerRescheduled"
        title={t("admin.settings.bmOwnerRescheduled")}
        statusLabel={
          templateConfigured[TEMPLATE_OWNER_RESCHEDULED]
            ? t("admin.settings.bmConfigured")
            : t("admin.settings.bmNotConfigured")
        }
        statusTone={
          templateConfigured[TEMPLATE_OWNER_RESCHEDULED] ? "ready" : "idle"
        }
        open={openCard === "ownerRescheduled"}
        onToggle={() => toggleCard("ownerRescheduled")}
      >
        <ApprovedTemplateDetails
          templateName={TEMPLATE_OWNER_RESCHEDULED}
          envName={ENV_OWNER_RESCHEDULED}
          language={t("admin.settings.bmLanguageAr")}
          configured={Boolean(templateConfigured[TEMPLATE_OWNER_RESCHEDULED])}
          enabled={value.ownerNotification.enabled}
          previewText={TWILIO_OWNER_RESCHEDULED_PREVIEW}
        />
      </AccordionCard>

      <AccordionCard
        id="ownerCancelled"
        title={t("admin.settings.bmOwnerCancelled")}
        statusLabel={
          templateConfigured[TEMPLATE_OWNER_CANCELLED]
            ? t("admin.settings.bmConfigured")
            : t("admin.settings.bmNotConfigured")
        }
        statusTone={
          templateConfigured[TEMPLATE_OWNER_CANCELLED] ? "ready" : "idle"
        }
        open={openCard === "ownerCancelled"}
        onToggle={() => toggleCard("ownerCancelled")}
      >
        <ApprovedTemplateDetails
          templateName={TEMPLATE_OWNER_CANCELLED}
          envName={ENV_OWNER_CANCELLED}
          language={t("admin.settings.bmLanguageAr")}
          configured={Boolean(templateConfigured[TEMPLATE_OWNER_CANCELLED])}
          enabled={value.ownerNotification.enabled}
          previewText={TWILIO_OWNER_CANCELLED_PREVIEW}
        />
      </AccordionCard>

      <AccordionCard
        id="reminder"
        title={t("admin.settings.bmReminder")}
        statusLabel={
          value.appointmentReminder.enabled
            ? t("admin.settings.bmEnabled")
            : t("admin.settings.bmInactive")
        }
        statusTone={value.appointmentReminder.enabled ? "on" : "off"}
        open={openCard === "reminder"}
        onToggle={() => toggleCard("reminder")}
      >
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
      </AccordionCard>
    </div>
  );
}

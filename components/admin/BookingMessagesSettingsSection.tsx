"use client";

import { useState } from "react";
import {
  Bell,
  Clock,
  MessageCircle,
  Phone,
  Plug,
  UserRound,
  Zap,
} from "lucide-react";
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

export default function BookingMessagesSettingsSection({
  value,
  templates,
  onChange,
}: Props) {
  const { t } = useLocale();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function testMetaConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch<{ ok: boolean; message?: string; error?: string }>(
        "/api/settings/test-meta",
        { method: "POST" },
      );
      if (data.ok) {
        setTestResult({
          ok: true,
          message: data.message || t("admin.settings.bmMetaTestSuccess"),
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error || t("admin.settings.bmMetaTestError"),
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error ? err.message : t("admin.settings.bmMetaTestError"),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="admin-bm">
      <section className="admin-bm-card">
        <header className="admin-bm-card-head">
          <span className="admin-bm-card-title">
            <Plug className="admin-bm-gold-icon" size={16} strokeWidth={1.75} aria-hidden />
            {t("admin.settings.bmProvider")}
          </span>
        </header>
        <div className="admin-bm-provider-row">
          <select
            className="select admin-bm-select"
            value={value.provider}
            onChange={(e) =>
              onChange({
                ...value,
                provider: e.target.value as BookingMessagesSettings["provider"],
              })
            }
          >
            <option value="meta">{t("admin.settings.bmProviderMeta")}</option>
            <option value="console">{t("admin.settings.bmProviderConsole")}</option>
          </select>
          <button
            type="button"
            className="btn btn-ghost admin-bm-test-btn"
            onClick={() => void testMetaConnection()}
            disabled={testing || value.provider !== "meta"}
          >
            <Zap size={14} strokeWidth={1.75} aria-hidden />
            {testing ? t("admin.settings.bmMetaTesting") : t("admin.settings.bmMetaTest")}
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
        <p className="admin-bm-hint">{t("admin.settings.bmProviderHint")}</p>
      </section>

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
      </section>
    </div>
  );
}

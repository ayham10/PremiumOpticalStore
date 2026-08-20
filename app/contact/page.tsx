"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Map, MapPin, Phone } from "lucide-react";
import Reveal from "@/components/Reveal";
import PageAtmosphere from "@/components/PageAtmosphere";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatLocalPhone, phoneTelHref } from "@/lib/format";
import type { WorkingHours } from "@/lib/types";
import { buildPublicHoursLines } from "@/lib/working-hours";

type PublicSettings = {
  storeName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  whatsapp: string;
  googleMapsEmbedUrl: string;
  googleMapsLink: string;
  openingHours: WorkingHours[];
};

export default function ContactPage() {
  const { t } = useLocale();
  const { settings: liveSettings } = useBranding();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (!cancelled && data.settings) setSettings(data.settings);
      } catch {
        // keep null; page still usable with form
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("validation.generic"));
      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : t("validation.generic"));
    }
  }

  const whatsapp = settings?.whatsapp || "9725550180";
  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    "Hello Oyon, I would like assistance."
  )}`;
  const phoneRaw = liveSettings?.phone || settings?.phone || "+972-3-555-0180";
  const phoneDisplay = formatLocalPhone(phoneRaw);
  const phoneHref = phoneTelHref(phoneRaw);
  const hourLines = buildPublicHoursLines(
    liveSettings?.openingHours || settings?.openingHours,
    (day) => t(`days.${day}`),
    t("contact.closed"),
  );
  const locationLine = [
    liveSettings?.address || settings?.address || "128 King George Street",
    liveSettings?.city || settings?.city || "Tel Aviv",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={t("contact.eyebrow")}
        title={t("contact.title")}
        lead={t("contact.lead")}
        image="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80"
      />
      <div className="wrap relative z-10">
        <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <form onSubmit={onSubmit} className="surface p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="label">{t("contact.name")}</span>
                  <input
                    className="input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span className="label">{t("contact.email")}</span>
                  <input
                    className="input"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label>
                  <span className="label">{t("contact.phone")}</span>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  <span className="label">{t("contact.subject")}</span>
                  <input
                    className="input"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="label">{t("contact.message")}</span>
                  <textarea
                    className="textarea"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                  />
                </label>
              </div>

              {status === "sent" && (
                <p className="mt-4 text-sm font-medium text-[var(--success)]">
                  {t("contact.sent")}
                </p>
              )}
              {error && (
                <p className="mt-4 text-sm font-medium text-[var(--danger)]">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? t("contact.sending") : t("contact.send")}
                </button>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  {t("contact.whatsapp")}
                </a>
              </div>
            </form>
          </Reveal>

          <Reveal delay={100}>
            <div className="oyon-contact-aside-wrap space-y-8">
              <div className="oyon-contact-aside oyon-footer-info">
                <div>
                  <h2 className="oyon-contact-store">
                    {settings?.storeName || "Oyon"}
                  </h2>
                  <a
                    className="oyon-contact-email"
                    href={`mailto:${settings?.email || "hello@oyon.optics"}`}
                  >
                    {settings?.email || "hello@oyon.optics"}
                  </a>
                </div>

                <div className="oyon-footer-hours-card">
                  <p className="oyon-footer-heading">
                    <Clock className="oyon-footer-icon" size={16} strokeWidth={1.75} aria-hidden />
                    <span>{t("contact.hours")}</span>
                  </p>
                  {hourLines.length ? (
                    <div className="oyon-footer-hours">
                      {hourLines.map((line) => (
                        <span key={line.key} className="oyon-footer-hours-line">
                          <strong>{line.label}</strong>
                          {line.closed ? (
                            <span>{line.value}</span>
                          ) : (
                            <span dir="ltr">{line.value}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="oyon-footer-item">
                  <Phone className="oyon-footer-icon" size={16} strokeWidth={1.75} aria-hidden />
                  <p className="oyon-footer-item-body">
                    <span className="oyon-footer-kicker">{t("contact.phone")}</span>
                    <a href={phoneHref || undefined} dir="ltr">
                      {phoneDisplay}
                    </a>
                  </p>
                </div>

                <div className="oyon-footer-item">
                  <MapPin className="oyon-footer-icon" size={16} strokeWidth={1.75} aria-hidden />
                  <p className="oyon-footer-item-body">
                    <span className="oyon-footer-kicker">{t("footer.location")}</span>
                    <span>{locationLine}</span>
                  </p>
                </div>

                {settings?.googleMapsLink ? (
                  <div className="oyon-footer-map-actions">
                    <a
                      href={settings.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="oyon-footer-map-btn"
                    >
                      <Map size={18} strokeWidth={1.75} aria-hidden />
                      {t("contact.maps")}
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--mist)]">
                <iframe
                  title="Oyon map"
                  src={
                    settings?.googleMapsEmbedUrl ||
                    "https://maps.google.com/maps?q=Tel%20Aviv&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  }
                  className="h-[280px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/book" className="btn btn-accent">
                  {t("contact.bookCta")}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

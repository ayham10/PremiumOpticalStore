"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { dayLabel } from "@/lib/appointments";
import type { WorkingHours } from "@/lib/types";

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
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  const whatsapp = settings?.whatsapp || "9725550180";
  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    "Hello LUMINA, I would like assistance."
  )}`;

  return (
    <div className="pb-20 pt-28">
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">Contact</span>
          <h1 className="section-title">We&apos;d love to hear from you</h1>
          <p className="section-lead">
            Questions about exams, frames, or fittings — send a note or message
            us on WhatsApp.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <form onSubmit={onSubmit} className="surface p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="label">Name</span>
                  <input
                    className="input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span className="label">Email</span>
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
                  <span className="label">Phone (optional)</span>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  <span className="label">Subject</span>
                  <input
                    className="input"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="label">Message</span>
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
                  Message sent — we&apos;ll get back to you soon.
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
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  WhatsApp
                </a>
              </div>
            </form>
          </Reveal>

          <Reveal delay={100}>
            <div className="space-y-8">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">
                  Visit {settings?.storeName || "LUMINA"}
                </h2>
                <p className="mt-3 text-[var(--ink-soft)]">
                  {settings?.address || "128 King George Street"}
                  <br />
                  {settings?.city || "Tel Aviv"}
                </p>
                <p className="mt-4">
                  <a
                    href={`tel:${settings?.phone || "+972-3-555-0180"}`}
                    className="hover:text-[var(--accent)]"
                  >
                    {settings?.phone || "+972-3-555-0180"}
                  </a>
                </p>
                <p>
                  <a
                    href={`mailto:${settings?.email || "hello@lumina.optics"}`}
                    className="hover:text-[var(--accent)]"
                  >
                    {settings?.email || "hello@lumina.optics"}
                  </a>
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--slate)]">
                  Hours
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[var(--ink-soft)]">
                  {(settings?.openingHours || []).map((h) => (
                    <li key={h.day} className="flex justify-between gap-4">
                      <span>{dayLabel(h.day)}</span>
                      <span>
                        {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--mist)]">
                <iframe
                  title="LUMINA map"
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
                {settings?.googleMapsLink && (
                  <a
                    href={settings.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                  >
                    Open in Maps
                  </a>
                )}
                <Link href="/book" className="btn btn-accent">
                  Book Eye Exam
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

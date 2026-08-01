"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

const WHATSAPP_MESSAGES: Record<Locale, string> = {
  en: "Hello Oyon, I would like assistance with an eye exam / glasses.",
  he: "שלום Oyon, אשמח לעזרה בנוגע לבדיקת עיניים / משקפיים.",
  ar: "مرحباً عيون، أود المساعدة بخصوص فحص النظر / النظارات.",
};

export default function WhatsAppButton({ phone = "9725550180" }: { phone?: string }) {
  const { locale, t } = useLocale();
  const message = WHATSAPP_MESSAGES[locale] || WHATSAPP_MESSAGES.en;
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-fab"
      aria-label={t("contact.whatsapp")}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9 9 0 1 1 12 20.5zm5.2-6.7c-.3-.1-1.7-.8-1.9-.9s-.5-.1-.7.1-.8.9-1 1.1-.4.2-.7.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3 0-.5l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.8 2.2.7 2.6.6s1.3-.5 1.5-1.1.2-1 .1-1.1c-.1-.2-.3-.2-.6-.4z" />
      </svg>
    </Link>
  );
}

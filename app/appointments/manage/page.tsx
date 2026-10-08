"use client";

import { Suspense, useEffect } from "react";
import { CalendarDays, Glasses } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

function ManageChrome({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="oyon-manage-page">
      <div className="oyon-manage-glow" aria-hidden />
      <div className="oyon-manage-side oyon-manage-side-start" aria-hidden />
      <div className="oyon-manage-side oyon-manage-side-end" aria-hidden />
      <div className="oyon-manage-wrap">
        <header className="oyon-manage-hero">
          <CalendarDays size={22} strokeWidth={1.5} aria-hidden />
          <h1>{t("manage.title")}</h1>
          <p>{t("manage.lead")}</p>
          <div className="oyon-manage-divider" aria-hidden>
            <span />
            <Glasses size={16} strokeWidth={1.6} />
            <span />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function ManageIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const token = searchParams.get("token")?.trim() || "";

  useEffect(() => {
    if (token) {
      router.replace(`/appointments/manage/${encodeURIComponent(token)}`);
    }
  }, [router, token]);

  if (token) {
    return (
      <ManageChrome>
        <p className="oyon-manage-banner">{t("manage.loading")}</p>
      </ManageChrome>
    );
  }

  return (
    <ManageChrome>
      <p className="oyon-manage-banner is-error">{t("manage.expired")}</p>
    </ManageChrome>
  );
}

export default function ManageAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="oyon-manage-page">
          <div className="oyon-manage-wrap">
            <p className="oyon-manage-banner">جارٍ التحميل…</p>
          </div>
        </div>
      }
    >
      <ManageIndex />
    </Suspense>
  );
}

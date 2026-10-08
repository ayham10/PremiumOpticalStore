"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { EXPIRED_MANAGE_LINK_MESSAGE } from "@/lib/booking-manage-constants";

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
      <div className="wrap pb-20 pt-28 text-[var(--slate)]">{t("manage.loading")}</div>
    );
  }

  return (
    <div className="pb-20 pt-28">
      <div className="wrap max-w-2xl">
        <Reveal>
          <span className="eyebrow">{t("manage.eyebrow")}</span>
          <h1 className="section-title">{t("manage.title")}</h1>
          <p className="section-lead mt-6 text-[var(--ink-soft)]">
            {EXPIRED_MANAGE_LINK_MESSAGE}
          </p>
        </Reveal>
      </div>
    </div>
  );
}

export default function ManageAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap pb-20 pt-28 text-[var(--slate)]">Loading…</div>
      }
    >
      <ManageIndex />
    </Suspense>
  );
}

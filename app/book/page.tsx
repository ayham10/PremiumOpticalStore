"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Reveal from "@/components/Reveal";
import BookingWizard from "@/components/booking/BookingWizard";
import { useLocale } from "@/components/i18n/LocaleProvider";

function BookContent() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service");
  const { t } = useLocale();

  return (
    <div className="pb-20 pt-28">
      <div className="wrap max-w-4xl">
        <Reveal>
          <span className="eyebrow">{t("book.eyebrow")}</span>
          <h1 className="section-title">{t("book.title")}</h1>
          <p className="section-lead">{t("book.lead")}</p>
        </Reveal>
        <div className="mt-10">
          <BookingWizard initialService={service} />
        </div>
      </div>
    </div>
  );
}

function BookFallback() {
  const { t } = useLocale();
  return (
    <div className="wrap pb-20 pt-28 text-[var(--slate)]">{t("book.loading")}</div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<BookFallback />}>
      <BookContent />
    </Suspense>
  );
}

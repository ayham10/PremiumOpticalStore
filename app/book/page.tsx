"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageAtmosphere from "@/components/PageAtmosphere";
import BookingWizard from "@/components/booking/BookingWizard";
import { useLocale } from "@/components/i18n/LocaleProvider";

function BookContent() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service");
  const { t } = useLocale();

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={t("book.eyebrow")}
        title={t("book.title")}
        lead={t("book.lead")}
        image="https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1800&q=80"
      />
      <div className="wrap relative z-10 max-w-4xl">
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

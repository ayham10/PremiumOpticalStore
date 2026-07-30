"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Reveal from "@/components/Reveal";
import BookingWizard from "@/components/booking/BookingWizard";

function BookContent() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service");

  return (
    <div className="pb-20 pt-28">
      <div className="wrap max-w-4xl">
        <Reveal>
          <span className="eyebrow">Appointments</span>
          <h1 className="section-title">Book your visit</h1>
          <p className="section-lead">
            Reserve an eye exam or fitting in a few calm steps. You&apos;ll receive
            a manage link to reschedule anytime.
          </p>
        </Reveal>
        <div className="mt-10">
          <BookingWizard initialService={service} />
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap pb-20 pt-28 text-[var(--slate)]">Loading booking…</div>
      }
    >
      <BookContent />
    </Suspense>
  );
}

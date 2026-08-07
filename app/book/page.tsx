import type { Metadata } from "next";
import { Suspense } from "react";
import ClinicBookingPage from "@/components/booking/ClinicBookingPage";

export const metadata: Metadata = {
  title: "Book an Appointment | Oyon Optical",
  description: "Book an eye exam, contact lens fitting, or eyewear consultation at Oyon.",
};

function BookFallback() {
  return (
    <div className="clinic-book-page" aria-busy="true">
      <div className="clinic-book-inner wrap">
        <header className="clinic-book-header">
          <span className="product-skeleton-line" style={{ width: "12rem", height: "1.5rem" }} />
        </header>
        <section className="clinic-book-card">
          <div className="clinic-book-service-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="product-skeleton-block"
                style={{ height: "4.2rem", borderRadius: "12px" }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<BookFallback />}>
      <ClinicBookingPage />
    </Suspense>
  );
}

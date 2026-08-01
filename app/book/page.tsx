import type { Metadata } from "next";
import { Suspense } from "react";
import ClinicBookingPage from "@/components/booking/ClinicBookingPage";

export const metadata: Metadata = {
  title: "Book an Appointment | Oyon Optical",
  description: "Book an eye exam, contact lens fitting, or eyewear consultation at Oyon.",
};

function BookFallback() {
  return <div className="clinic-book-page" />;
}

export default function BookPage() {
  return (
    <Suspense fallback={<BookFallback />}>
      <ClinicBookingPage />
    </Suspense>
  );
}

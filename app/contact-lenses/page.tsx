import type { Metadata } from "next";
import { Suspense } from "react";
import ContactLensesPage from "@/components/contact-lenses/ContactLensesPage";

export const metadata: Metadata = {
  title: "Contact Lenses | LUMINA Optical",
  description:
    "Find comfortable contact lenses suited to your vision, lifestyle and daily routine.",
};

export default function ContactLensesRoute() {
  return (
    <Suspense fallback={<div className="frames-page" />}>
      <ContactLensesPage />
    </Suspense>
  );
}

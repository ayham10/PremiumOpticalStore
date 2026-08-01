import type { Metadata } from "next";
import ContactLensesPage from "@/components/contact-lenses/ContactLensesPage";

export const metadata: Metadata = {
  title: "Contact Lenses | Oyon Optical",
  description:
    "Find comfortable contact lenses suited to your vision, lifestyle and daily routine.",
};

export default function ContactLensesRoute() {
  return <ContactLensesPage />;
}

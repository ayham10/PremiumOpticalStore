import type { Metadata } from "next";
import DestinationPage from "@/components/home/DestinationPage";

export const metadata: Metadata = {
  title: "Contact Lenses — LUMINA Optical",
  description: "Daily and monthly contact lenses fitted for comfort and clarity.",
};

export default function ContactLensesPage() {
  return (
    <DestinationPage
      destKey="contacts"
      image="https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=1800&q=80"
      primaryHref="/shop?category=Contact%20Lenses"
      secondaryHref="/book?service=Contact%20Lenses"
      gallery={[
        "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
      ]}
    />
  );
}

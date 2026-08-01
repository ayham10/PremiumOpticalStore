import type { Metadata } from "next";
import DestinationPage from "@/components/home/DestinationPage";

export const metadata: Metadata = {
  title: "Sunglasses — LUMINA Optical",
  description: "Polarized sunglasses and sun protection with refined design.",
};

export default function SunglassesPage() {
  return (
    <DestinationPage
      destKey="sunglasses"
      image="https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1800&q=80"
      primaryHref="/shop?category=Sunglasses"
      secondaryHref="/book?service=Sunglasses%20Fitting"
      gallery={[
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=900&q=80",
      ]}
    />
  );
}

import type { Metadata } from "next";
import DestinationPage from "@/components/home/DestinationPage";

export const metadata: Metadata = {
  title: "Premium Frames — LUMINA Optical",
  description: "Curated premium frames fitted with quiet precision.",
};

export default function FramesPage() {
  return (
    <DestinationPage
      destKey="frames"
      image="https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1800&q=80"
      primaryHref="/shop?category=Frames"
      secondaryHref="/book?service=Eyeglass%20Frames"
      gallery={[
        "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80",
      ]}
    />
  );
}

import type { Metadata } from "next";
import FramesCatalogue from "@/components/frames/FramesCatalogue";

export const metadata: Metadata = {
  title: "Premium Frames | LUMINA Optical",
  description:
    "Curated premium eyeglass frames in acetate, titanium, and metal — fitted with quiet precision.",
};

export default function FramesPage() {
  return <FramesCatalogue />;
}

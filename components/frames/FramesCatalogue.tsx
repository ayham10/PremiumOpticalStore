"use client";

import CategoryCatalogue from "@/components/catalogue/CategoryCatalogue";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function FramesCatalogue() {
  const { dict } = useLocale();

  return (
    <CategoryCatalogue
      categories={["Frames", "Prescription Glasses"]}
      title={dict.destinations.frames.title}
      lead={dict.destinations.frames.lead}
      videoSrc="/videos/premium-frames.mp4"
      posterSrc="/images/premium-video-poster.jpg"
    />
  );
}

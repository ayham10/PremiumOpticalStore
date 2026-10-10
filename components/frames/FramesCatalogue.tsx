"use client";

import CategoryCatalogue from "@/components/catalogue/CategoryCatalogue";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  DEFAULT_FRAMES_HERO_POSTER,
  DEFAULT_FRAMES_HERO_VIDEO,
} from "@/lib/page-hero-media";
import { pickServiceText } from "@/lib/service-pages";
import { useLocalizedServicePages } from "@/lib/use-service-pages";

export default function FramesCatalogue() {
  const { dict } = useLocale();
  const saved = useLocalizedServicePages()?.frames;

  return (
    <CategoryCatalogue
      categories={["Frames", "Prescription Glasses"]}
      title={pickServiceText(saved?.title, dict.destinations.frames.title)}
      lead={pickServiceText(saved?.lead, dict.destinations.frames.lead)}
      videoSrc={DEFAULT_FRAMES_HERO_VIDEO}
      posterSrc={DEFAULT_FRAMES_HERO_POSTER}
      activeFilter="Prescription Frames"
      bookHref="/book?type=frame_consultation"
      bookLabel={dict.home.bookAppointment}
      heroMedia={saved?.heroMedia}
      heroSectionId="frames-hero"
    />
  );
}

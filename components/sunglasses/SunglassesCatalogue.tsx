"use client";

import CategoryCatalogue from "@/components/catalogue/CategoryCatalogue";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  DEFAULT_SUNGLASSES_HERO_LOOP_TAIL_SECONDS,
  DEFAULT_SUNGLASSES_HERO_POSTER,
  DEFAULT_SUNGLASSES_HERO_VIDEO,
} from "@/lib/page-hero-media";
import { pickServiceText } from "@/lib/service-pages";
import { useLocalizedServicePages } from "@/lib/use-service-pages";

export default function SunglassesCatalogue() {
  const { dict } = useLocale();
  const saved = useLocalizedServicePages()?.sunglasses;

  return (
    <CategoryCatalogue
      categories={["Sunglasses"]}
      title={pickServiceText(saved?.title, dict.destinations.sunglasses.title)}
      lead={pickServiceText(saved?.lead, dict.destinations.sunglasses.lead)}
      videoSrc={DEFAULT_SUNGLASSES_HERO_VIDEO}
      posterSrc={DEFAULT_SUNGLASSES_HERO_POSTER}
      videoLoopTailSeconds={DEFAULT_SUNGLASSES_HERO_LOOP_TAIL_SECONDS}
      activeFilter="Sunglasses"
      bookHref="/book?type=sunglasses_consultation"
      bookLabel={dict.home.bookAppointment}
      pageClass="sunglasses-page"
      heroMedia={saved?.heroMedia}
      heroSectionId="sunglasses-hero"
    />
  );
}

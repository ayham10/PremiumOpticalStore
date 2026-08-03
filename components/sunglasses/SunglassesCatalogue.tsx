"use client";

import CategoryCatalogue from "@/components/catalogue/CategoryCatalogue";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function SunglassesCatalogue() {
  const { dict } = useLocale();

  return (
    <CategoryCatalogue
      categories={["Sunglasses"]}
      title={dict.destinations.sunglasses.title}
      lead={dict.destinations.sunglasses.lead}
      videoSrc="/videos/sunglasses-hero.mp4"
      posterSrc="/images/sunglasses-hero-poster.jpg"
      activeFilter="Sunglasses"
      bookHref="/book?type=sunglasses_consultation"
      bookLabel={dict.home.bookAppointment}
    />
  );
}

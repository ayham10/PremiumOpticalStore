import type { CustomSectionType } from "@/lib/types";

export type SectionHelpKind =
  | CustomSectionType
  | "homepageHero"
  | "catalogHero"
  | "buttons"
  | "footer";

export const SECTION_HELP_I18N: Record<
  SectionHelpKind,
  { title: string; body: string }
> = {
  heroMedia: {
    title: "admin.servicePages.sectionHero",
    body: "admin.servicePages.helpHero",
  },
  homepageHero: {
    title: "admin.servicePages.sectionHero",
    body: "admin.servicePages.helpHomepageHero",
  },
  catalogHero: {
    title: "admin.servicePages.sectionHero",
    body: "admin.servicePages.helpCatalogHero",
  },
  featureGrid: {
    title: "admin.servicePages.sectionFeatures",
    body: "admin.servicePages.helpFeatures",
  },
  benefitsList: {
    title: "admin.servicePages.sectionBenefits",
    body: "admin.servicePages.helpBenefits",
  },
  notice: {
    title: "admin.servicePages.sectionNotice",
    body: "admin.servicePages.helpNotice",
  },
  valuesStrip: {
    title: "admin.servicePages.sectionValues",
    body: "admin.servicePages.helpValues",
  },
  bookingCta: {
    title: "admin.servicePages.sectionBooking",
    body: "admin.servicePages.helpBooking",
  },
  buttons: {
    title: "admin.servicePages.sectionButtons",
    body: "admin.servicePages.helpButtons",
  },
  gallery: {
    title: "admin.servicePages.sectionGallery",
    body: "admin.servicePages.helpGallery",
  },
  products: {
    title: "admin.servicePages.sectionProducts",
    body: "admin.servicePages.helpProducts",
  },
  footer: {
    title: "admin.servicePages.sectionFooter",
    body: "admin.servicePages.helpFooter",
  },
};

export const CUSTOM_SECTION_HELP_KIND: Record<CustomSectionType, SectionHelpKind> =
  {
    heroMedia: "heroMedia",
    featureGrid: "featureGrid",
    benefitsList: "benefitsList",
    notice: "notice",
    valuesStrip: "valuesStrip",
    bookingCta: "bookingCta",
    gallery: "gallery",
    products: "products",
  };

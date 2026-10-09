import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import he from "@/lib/i18n/dictionaries/he";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
} from "@/lib/service-page-icons";
import {
  DEFAULT_SERVICE_PAGES,
  SERVICE_LABEL_COUNT,
  cloneLocaleBundle,
} from "@/lib/service-pages";
import type {
  ServicePagesLocale,
  ServicePagesLocaleBundle,
} from "@/lib/types";

const DICTIONARIES: Record<ServicePagesLocale, Dictionary> = { ar, he, en };

function padLabels(line: string): string[] {
  const parts = line.split(/\s*•\s*/).filter(Boolean);
  return Array.from(
    { length: SERVICE_LABEL_COUNT },
    (_, index) => parts[index] || "",
  );
}

export function servicePagesDefaultsFromDictionary(
  dict: Dictionary,
): ServicePagesLocaleBundle {
  const labels = padLabels(dict.home.welcomeLine);
  return {
    eyeExam: {
      eyebrow: dict.eyeExam.eyebrow,
      title: dict.eyeExam.title,
      description: dict.eyeExam.description,
      bookingButtonText: dict.eyeExam.bookCta,
      features: [
        {
          title: dict.eyeExam.features.specialists,
          description: dict.eyeExam.features.specialistsLead,
          icon: EYE_EXAM_DEFAULT_FEATURE_ICONS[0],
        },
        {
          title: dict.eyeExam.features.duration,
          description: dict.eyeExam.features.durationLead,
          icon: EYE_EXAM_DEFAULT_FEATURE_ICONS[1],
        },
        {
          title: dict.eyeExam.features.equipment,
          description: dict.eyeExam.features.equipmentLead,
          icon: EYE_EXAM_DEFAULT_FEATURE_ICONS[2],
        },
        {
          title: dict.eyeExam.features.comprehensive,
          description: dict.eyeExam.features.comprehensiveLead,
          icon: EYE_EXAM_DEFAULT_FEATURE_ICONS[3],
        },
      ],
      benefitsTitle: dict.eyeExam.benefits.title,
      benefits: [...dict.eyeExam.benefits.items],
    },
    contactLenses: {
      eyebrow: dict.contactLenses.eyebrow,
      title: dict.contactLenses.title,
      description: dict.contactLenses.description,
      bookingButtonText: dict.contactLenses.bookCta,
      features: [
        {
          title: dict.contactLenses.info.fittingTitle,
          description: dict.contactLenses.info.fittingText,
          icon: CONTACT_LENSES_DEFAULT_FEATURE_ICONS[0],
        },
        {
          title: dict.contactLenses.info.optionsTitle,
          description: dict.contactLenses.info.optionsText,
          icon: CONTACT_LENSES_DEFAULT_FEATURE_ICONS[1],
        },
        {
          title: dict.contactLenses.info.supportTitle,
          description: dict.contactLenses.info.supportText,
          icon: CONTACT_LENSES_DEFAULT_FEATURE_ICONS[2],
        },
        {
          title: dict.contactLenses.info.safetyTitle,
          description: dict.contactLenses.info.safetyText,
          icon: CONTACT_LENSES_DEFAULT_FEATURE_ICONS[3],
        },
      ],
      warningText: dict.contactLenses.safety,
    },
    homepage: {
      hero: {
        title: dict.hero.title,
        subtitle: dict.home.welcomeLine,
        serviceLabels: labels,
        bookingButtonText: dict.home.bookAppointment,
        shopButtonText: dict.home.shopNow,
      },
    },
    footer: {
      tagline: dict.footer.tagline,
      hoursLabel: dict.footer.hours,
      locationLabel: dict.footer.location,
      address: dict.footer.city,
    },
  };
}

export function defaultServicePagesForLocale(
  locale: ServicePagesLocale,
): ServicePagesLocaleBundle {
  if (locale === "ar") {
    return cloneLocaleBundle({
      eyeExam: DEFAULT_SERVICE_PAGES.eyeExam,
      contactLenses: DEFAULT_SERVICE_PAGES.contactLenses,
      homepage: DEFAULT_SERVICE_PAGES.homepage,
      footer: DEFAULT_SERVICE_PAGES.footer,
    });
  }
  return servicePagesDefaultsFromDictionary(DICTIONARIES[locale]);
}

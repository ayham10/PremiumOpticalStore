import {
  assertValidCustomSlug,
  CustomPageError,
  filledText,
  normalizeCustomSlug,
  pageHasVisibleButton,
  pageUsesSectionButtons,
  resolveCtaHref,
  resolveSectionButtonHref,
  resolveSectionButtonLabel,
  visibleButtonSections,
  visibleCustomBenefits,
  visibleCustomSections,
} from "@/lib/custom-service-pages";
import type {
  CatalogServicePage,
  ContactLensesServicePage,
  CustomPageCopy,
  CustomPageCtaKind,
  CustomPageSection,
  EyeExamServicePage,
  FooterServiceContent,
  HomepageServicePage,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
} from "@/lib/types";

export type FieldRequirement = "save" | "display";

export type ContentFieldIssue = {
  id: string;
  fieldId: string;
  sectionId: string;
  requirement: FieldRequirement;
  messageKey: string;
  messageVars?: Record<string, string | number>;
};

export const CONTENT_FIELD_IDS = {
  pageName: "csp-page-name",
  pageSlug: "csp-page-slug",
  title: "csp-title",
  description: "csp-description",
  bookingButton: "csp-booking-button",
  ctaInternal: "csp-cta-internal",
  ctaExternal: "csp-cta-external",
  buttonLabel: (id: string) => `csp-btn-${id}-label`,
  buttonInternal: (id: string) => `csp-btn-${id}-internal`,
  buttonExternal: (id: string) => `csp-btn-${id}-external`,
  featureTitle: (n: number) => `csp-feature-${n}-title`,
  featureDescription: (n: number) => `csp-feature-${n}-description`,
  benefitsTitle: "csp-benefits-title",
  benefit: (n: number) => `csp-benefit-${n}`,
  warningText: "csp-warning-text",
  valuesTitle: "csp-values-title",
  valuesText: "csp-values-text",
} as const;

export const BUILT_IN_FIELD_IDS = {
  homeTitle: "bi-home-title",
  homeBooking: "bi-home-booking",
  homeShop: "bi-home-shop",
  eyeTitle: "bi-eye-title",
  eyeDescription: "bi-eye-description",
  eyeBooking: "bi-eye-booking",
  eyeFeatureTitle: (n: number) => `bi-eye-feature-${n}-title`,
  eyeFeatureDescription: (n: number) => `bi-eye-feature-${n}-description`,
  eyeBenefitsTitle: "bi-eye-benefits-title",
  eyeBenefit: (n: number) => `bi-eye-benefit-${n}`,
  lensesTitle: "bi-lenses-title",
  lensesDescription: "bi-lenses-description",
  lensesBooking: "bi-lenses-booking",
  lensesFeatureTitle: (n: number) => `bi-lenses-feature-${n}-title`,
  lensesFeatureDescription: (n: number) => `bi-lenses-feature-${n}-description`,
  lensesWarning: "bi-lenses-warning",
  catalogTitle: "bi-catalog-title",
  sunglassesTitle: "bi-sunglasses-title",
  framesTitle: "bi-frames-title",
  footerTagline: "bi-footer-tagline",
} as const;

function issue(
  partial: Omit<ContentFieldIssue, "id"> & { id?: string },
): ContentFieldIssue {
  return {
    id: partial.id || `${partial.sectionId}:${partial.fieldId}`,
    fieldId: partial.fieldId,
    sectionId: partial.sectionId,
    requirement: partial.requirement,
    messageKey: partial.messageKey,
    messageVars: partial.messageVars,
  };
}

function sectionIdForType(
  sections: CustomPageSection[],
  type: CustomPageSection["type"],
  fallback: string,
): string {
  return (
    visibleCustomSections(sections).find((section) => section.type === type)?.id ||
    sections.find((section) => section.type === type)?.id ||
    fallback
  );
}

function hasVisibleType(
  sections: CustomPageSection[],
  type: CustomPageSection["type"],
): boolean {
  return visibleCustomSections(sections).some((section) => section.type === type);
}

function pushIncompleteFeatures(
  issues: ContentFieldIssue[],
  features: Array<{ title?: string; description?: string }> | undefined,
  sectionId: string,
  needed: number,
  ids: {
    title: (n: number) => string;
    description: (n: number) => string;
  },
  keys: { title: string; description: string },
): void {
  const list = features || [];
  const completeCount = list.filter(
    (feature) => filledText(feature.title) && filledText(feature.description),
  ).length;
  if (completeCount >= needed) return;
  let remaining = needed - completeCount;
  for (let index = 0; index < list.length && remaining > 0; index += 1) {
    const n = index + 1;
    const title = filledText(list[index]?.title);
    const description = filledText(list[index]?.description);
    if (title && description) continue;
    if (!title) {
      issues.push(
        issue({
          fieldId: ids.title(n),
          sectionId,
          requirement: "display",
          messageKey: keys.title,
          messageVars: { n },
        }),
      );
    }
    if (!description) {
      issues.push(
        issue({
          fieldId: ids.description(n),
          sectionId,
          requirement: "display",
          messageKey: keys.description,
          messageVars: { n },
        }),
      );
    }
    remaining -= 1;
  }
}

function pushIncompleteBenefits(
  issues: ContentFieldIssue[],
  benefits: string[] | undefined,
  sectionId: string,
  needed: number,
  idFor: (n: number) => string,
  messageKey: string,
): void {
  const filled = visibleCustomBenefits(benefits);
  if (filled.length >= needed) return;
  const list = benefits || [];
  let remaining = needed - filled.length;
  for (
    let index = 0;
    index < Math.max(list.length, needed) && remaining > 0;
    index += 1
  ) {
    if (filledText(list[index])) continue;
    issues.push(
      issue({
        fieldId: idFor(index + 1),
        sectionId,
        requirement: "display",
        messageKey,
        messageVars: { n: index + 1 },
      }),
    );
    remaining -= 1;
  }
}

export function customPageFieldIssues(input: {
  name: string;
  slug: string;
  sections: CustomPageSection[];
  copy: CustomPageCopy | undefined;
  showHeroButton: boolean;
  ctaKind: CustomPageCtaKind;
  ctaHref: string;
  bookingType?: string | null;
  locale?: ServicePagesLocale;
}): ContentFieldIssue[] {
  const issues: ContentFieldIssue[] = [];
  const copy = input.copy;
  const locale = input.locale || "ar";
  const heroSectionId = sectionIdForType(input.sections, "heroMedia", "page-copy");
  const buttonSectionId =
    sectionIdForType(input.sections, "bookingCta", "page-buttons") || "page-buttons";

  if (!filledText(input.name)) {
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.pageName,
        sectionId: "page-details",
        requirement: "save",
        messageKey: "admin.servicePages.missingPageName",
      }),
    );
  }

  const normalizedSlug = normalizeCustomSlug(input.slug);
  try {
    assertValidCustomSlug(normalizedSlug);
  } catch (error) {
    const reserved =
      error instanceof CustomPageError && error.code === "CUSTOM_PAGE_RESERVED";
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.pageSlug,
        sectionId: "page-details",
        requirement: "save",
        messageKey: reserved
          ? "admin.servicePages.slugReserved"
          : "admin.servicePages.slugInvalid",
      }),
    );
  }

  if (pageUsesSectionButtons(input.sections)) {
    for (const section of visibleButtonSections(input.sections)) {
      const kind = section.button?.ctaKind || "book";
      const href = resolveSectionButtonHref(section);
      if (kind === "internal" && !href) {
        issues.push(
          issue({
            fieldId: CONTENT_FIELD_IDS.buttonInternal(section.id),
            sectionId: section.id,
            requirement: "save",
            messageKey: "admin.servicePages.missingCtaInternal",
          }),
        );
      }
      if (kind === "external" && !href) {
        issues.push(
          issue({
            fieldId: CONTENT_FIELD_IDS.buttonExternal(section.id),
            sectionId: section.id,
            requirement: "save",
            messageKey: "admin.servicePages.missingCtaExternal",
          }),
        );
      }
    }
    if (hasVisibleType(input.sections, "bookingCta")) {
      const href = resolveCtaHref({
        ctaKind: input.ctaKind,
        bookingType: input.bookingType,
        ctaHref: input.ctaHref,
      });
      if (!href && input.ctaKind === "internal") {
        issues.push(
          issue({
            fieldId: CONTENT_FIELD_IDS.ctaInternal,
            sectionId: buttonSectionId,
            requirement: "save",
            messageKey: "admin.servicePages.missingCtaInternal",
          }),
        );
      }
      if (!href && input.ctaKind === "external") {
        issues.push(
          issue({
            fieldId: CONTENT_FIELD_IDS.ctaExternal,
            sectionId: buttonSectionId,
            requirement: "save",
            messageKey: "admin.servicePages.missingCtaExternal",
          }),
        );
      }
    }
  } else if (pageHasVisibleButton(input.sections, input.showHeroButton)) {
    const href = resolveCtaHref({
      ctaKind: input.ctaKind,
      bookingType: input.bookingType,
      ctaHref: input.ctaHref,
    });
    if (!href && input.ctaKind === "internal") {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.ctaInternal,
          sectionId: buttonSectionId,
          requirement: "save",
          messageKey: "admin.servicePages.missingCtaInternal",
        }),
      );
    }
    if (!href && input.ctaKind === "external") {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.ctaExternal,
          sectionId: buttonSectionId,
          requirement: "save",
          messageKey: "admin.servicePages.missingCtaExternal",
        }),
      );
    }
  }

  if (!copy || !filledText(copy.title)) {
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.title,
        sectionId: heroSectionId,
        requirement: "display",
        messageKey: "admin.servicePages.missingTitle",
      }),
    );
  }
  if (!copy || !filledText(copy.description)) {
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.description,
        sectionId: heroSectionId,
        requirement: "display",
        messageKey: "admin.servicePages.missingDescription",
      }),
    );
  }
  if (pageUsesSectionButtons(input.sections)) {
    for (const section of visibleButtonSections(input.sections)) {
      if (resolveSectionButtonLabel(section, locale)) continue;
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.buttonLabel(section.id),
          sectionId: section.id,
          requirement: "display",
          messageKey: "admin.servicePages.missingBookingButton",
        }),
      );
    }
    if (
      hasVisibleType(input.sections, "bookingCta") &&
      (!copy || !filledText(copy.bookingButtonText))
    ) {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.bookingButton,
          sectionId: buttonSectionId,
          requirement: "display",
          messageKey: "admin.servicePages.missingBookingButton",
        }),
      );
    }
  } else if (
    pageHasVisibleButton(input.sections, input.showHeroButton) &&
    (!copy || !filledText(copy.bookingButtonText))
  ) {
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.bookingButton,
        sectionId: buttonSectionId,
        requirement: "display",
        messageKey: "admin.servicePages.missingBookingButton",
      }),
    );
  }

  if (hasVisibleType(input.sections, "featureGrid")) {
    const sectionId = sectionIdForType(input.sections, "featureGrid", "featureGrid");
    pushIncompleteFeatures(
      issues,
      copy?.features,
      sectionId,
      2,
      {
        title: CONTENT_FIELD_IDS.featureTitle,
        description: CONTENT_FIELD_IDS.featureDescription,
      },
      {
        title: "admin.servicePages.missingFeatureTitle",
        description: "admin.servicePages.missingFeatureDescription",
      },
    );
  }

  if (hasVisibleType(input.sections, "benefitsList")) {
    const sectionId = sectionIdForType(
      input.sections,
      "benefitsList",
      "benefitsList",
    );
    if (!copy || !filledText(copy.benefitsTitle)) {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.benefitsTitle,
          sectionId,
          requirement: "display",
          messageKey: "admin.servicePages.missingBenefitsTitle",
        }),
      );
    }
    pushIncompleteBenefits(
      issues,
      copy?.benefits,
      sectionId,
      2,
      CONTENT_FIELD_IDS.benefit,
      "admin.servicePages.missingBenefit",
    );
  }

  if (hasVisibleType(input.sections, "notice") && (!copy || !filledText(copy.warningText))) {
    issues.push(
      issue({
        fieldId: CONTENT_FIELD_IDS.warningText,
        sectionId: sectionIdForType(input.sections, "notice", "notice"),
        requirement: "display",
        messageKey: "admin.servicePages.missingWarningText",
      }),
    );
  }

  if (hasVisibleType(input.sections, "valuesStrip")) {
    const sectionId = sectionIdForType(input.sections, "valuesStrip", "valuesStrip");
    if (!copy || !filledText(copy.valuesTitle)) {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.valuesTitle,
          sectionId,
          requirement: "display",
          messageKey: "admin.servicePages.missingValuesTitle",
        }),
      );
    }
    if (!copy || !filledText(copy.valuesText)) {
      issues.push(
        issue({
          fieldId: CONTENT_FIELD_IDS.valuesText,
          sectionId,
          requirement: "display",
          messageKey: "admin.servicePages.missingValuesText",
        }),
      );
    }
  }

  return issues;
}

export function builtInPageFieldIssues(
  tab:
    | "homepage"
    | "eyeExam"
    | "contactLenses"
    | "catalog"
    | "sunglasses"
    | "frames"
    | "footer",
  pages: Pick<
    ServicePagesLocaleBundle,
    | "homepage"
    | "eyeExam"
    | "contactLenses"
    | "catalog"
    | "sunglasses"
    | "frames"
    | "footer"
  >,
): ContentFieldIssue[] {
  const issues: ContentFieldIssue[] = [];

  if (tab === "homepage") {
    const home = pages.homepage as HomepageServicePage | undefined;
    if (!filledText(home?.hero.title)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.homeTitle,
          sectionId: "homepage-hero",
          requirement: "display",
          messageKey: "admin.servicePages.missingTitle",
        }),
      );
    }
    if (!filledText(home?.hero.bookingButtonText)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.homeBooking,
          sectionId: "homepage-buttons",
          requirement: "display",
          messageKey: "admin.servicePages.missingBookingButton",
        }),
      );
    }
    if (!filledText(home?.hero.shopButtonText)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.homeShop,
          sectionId: "homepage-buttons",
          requirement: "display",
          messageKey: "admin.servicePages.missingShopButton",
        }),
      );
    }
  }

  if (tab === "eyeExam") {
    const eye = pages.eyeExam as EyeExamServicePage;
    if (!filledText(eye.title)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.eyeTitle,
          sectionId: "eyeExam-hero",
          requirement: "display",
          messageKey: "admin.servicePages.missingTitle",
        }),
      );
    }
    if (!filledText(eye.description)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.eyeDescription,
          sectionId: "eyeExam-hero",
          requirement: "display",
          messageKey: "admin.servicePages.missingDescription",
        }),
      );
    }
    if (!filledText(eye.bookingButtonText)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.eyeBooking,
          sectionId: "eyeExam-buttons",
          requirement: "display",
          messageKey: "admin.servicePages.missingBookingButton",
        }),
      );
    }
    pushIncompleteFeatures(
      issues,
      eye.features,
      "eyeExam-features",
      2,
      {
        title: BUILT_IN_FIELD_IDS.eyeFeatureTitle,
        description: BUILT_IN_FIELD_IDS.eyeFeatureDescription,
      },
      {
        title: "admin.servicePages.missingFeatureTitle",
        description: "admin.servicePages.missingFeatureDescription",
      },
    );
    if (!filledText(eye.benefitsTitle)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.eyeBenefitsTitle,
          sectionId: "eyeExam-benefits",
          requirement: "display",
          messageKey: "admin.servicePages.missingBenefitsTitle",
        }),
      );
    }
    pushIncompleteBenefits(
      issues,
      eye.benefits,
      "eyeExam-benefits",
      2,
      BUILT_IN_FIELD_IDS.eyeBenefit,
      "admin.servicePages.missingBenefit",
    );
  }

  if (tab === "contactLenses") {
    const lenses = pages.contactLenses as ContactLensesServicePage;
    if (!filledText(lenses.title)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.lensesTitle,
          sectionId: "contactLenses-hero",
          requirement: "display",
          messageKey: "admin.servicePages.missingTitle",
        }),
      );
    }
    if (!filledText(lenses.description)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.lensesDescription,
          sectionId: "contactLenses-hero",
          requirement: "display",
          messageKey: "admin.servicePages.missingDescription",
        }),
      );
    }
    if (!filledText(lenses.bookingButtonText)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.lensesBooking,
          sectionId: "contactLenses-buttons",
          requirement: "display",
          messageKey: "admin.servicePages.missingBookingButton",
        }),
      );
    }
    pushIncompleteFeatures(
      issues,
      lenses.features,
      "contactLenses-features",
      2,
      {
        title: BUILT_IN_FIELD_IDS.lensesFeatureTitle,
        description: BUILT_IN_FIELD_IDS.lensesFeatureDescription,
      },
      {
        title: "admin.servicePages.missingFeatureTitle",
        description: "admin.servicePages.missingFeatureDescription",
      },
    );
    if (!filledText(lenses.warningText)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.lensesWarning,
          sectionId: "contactLenses-notice",
          requirement: "display",
          messageKey: "admin.servicePages.missingWarningText",
        }),
      );
    }
  }

  if (tab === "catalog" || tab === "sunglasses" || tab === "frames") {
    const page = pages[tab] as CatalogServicePage | undefined;
    const fieldId =
      tab === "catalog"
        ? BUILT_IN_FIELD_IDS.catalogTitle
        : tab === "sunglasses"
          ? BUILT_IN_FIELD_IDS.sunglassesTitle
          : BUILT_IN_FIELD_IDS.framesTitle;
    const sectionId =
      tab === "catalog"
        ? "catalog-hero"
        : tab === "sunglasses"
          ? "sunglasses-hero"
          : "frames-hero";
    if (!filledText(page?.title)) {
      issues.push(
        issue({
          fieldId,
          sectionId,
          requirement: "display",
          messageKey: "admin.servicePages.missingTitle",
        }),
      );
    }
  }

  if (tab === "footer") {
    const footer = pages.footer as FooterServiceContent | undefined;
    if (!filledText(footer?.tagline)) {
      issues.push(
        issue({
          fieldId: BUILT_IN_FIELD_IDS.footerTagline,
          sectionId: "footer-content",
          requirement: "display",
          messageKey: "admin.servicePages.missingFooterTagline",
        }),
      );
    }
  }

  return issues;
}

export function missingFieldIdSet(issues: ContentFieldIssue[]): Set<string> {
  return new Set(issues.map((item) => item.fieldId));
}

export function wizardStepForSection(sectionId: string): 1 | 2 | 3 | 4 {
  if (sectionId === "page-details") return 1;
  if (sectionId === "page-sections") return 2;
  if (sectionId === "page-review" || sectionId === "page-settings") return 4;
  return 3;
}

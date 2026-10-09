export const NEW_PAGE_WIZARD_STEPS = [1, 2, 3, 4] as const;
export type NewPageWizardStep = (typeof NEW_PAGE_WIZARD_STEPS)[number];

export const WIZARD_STEP_I18N: Record<
  NewPageWizardStep,
  { title: string; hint: string }
> = {
  1: {
    title: "admin.servicePages.wizardStep1",
    hint: "admin.servicePages.wizardStep1Hint",
  },
  2: {
    title: "admin.servicePages.wizardStep2",
    hint: "admin.servicePages.wizardStep2Hint",
  },
  3: {
    title: "admin.servicePages.wizardStep3",
    hint: "admin.servicePages.wizardStep3Hint",
  },
  4: {
    title: "admin.servicePages.wizardStep4",
    hint: "admin.servicePages.wizardStep4Hint",
  },
};

export function clampWizardStep(step: number): NewPageWizardStep {
  if (step <= 1) return 1;
  if (step >= 4) return 4;
  return step as NewPageWizardStep;
}

export function wizardCanGoBack(step: NewPageWizardStep): boolean {
  return step > 1;
}

export function wizardCanGoNext(step: NewPageWizardStep): boolean {
  return step < 4;
}

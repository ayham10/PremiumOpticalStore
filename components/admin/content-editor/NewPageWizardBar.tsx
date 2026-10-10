"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  NEW_PAGE_WIZARD_STEPS,
  WIZARD_STEP_I18N,
  formatWizardStepNumber,
  wizardCanGoBack,
  wizardCanGoNext,
  type NewPageWizardStep,
} from "@/lib/content-editor-wizard";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function NewPageWizardBar({
  step,
  t,
  dir,
  onStepChange,
}: {
  step: NewPageWizardStep;
  t: Translate;
  dir: "ltr" | "rtl";
  onStepChange: (step: NewPageWizardStep) => void;
}) {
  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="csp-wizard" dir={dir}>
      <ol className="csp-wizard-steps" aria-label={t("admin.servicePages.wizardProgress", { n: step, total: 4 })}>
        {NEW_PAGE_WIZARD_STEPS.map((item) => {
          const meta = WIZARD_STEP_I18N[item];
          return (
            <li key={item}>
              <button
                type="button"
                className={
                  item === step ? "is-current" : item < step ? "is-done" : ""
                }
                aria-current={item === step ? "step" : undefined}
                onClick={() => onStepChange(item)}
              >
                <i>{formatWizardStepNumber(item)}</i>
                <span>{t(meta.title)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="csp-wizard-hint">{t(WIZARD_STEP_I18N[step].hint)}</p>
      <div className="csp-wizard-nav">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!wizardCanGoBack(step)}
          onClick={() => onStepChange((step - 1) as NewPageWizardStep)}
        >
          <BackIcon size={15} />
          {t("admin.servicePages.wizardBack")}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          disabled={!wizardCanGoNext(step)}
          onClick={() => onStepChange((step + 1) as NewPageWizardStep)}
        >
          {t("admin.servicePages.wizardNext")}
          <NextIcon size={15} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import LensSizeModalIllustration from "@/components/admin/LensSizeModalIllustration";
import type { DeactivatedCustomSize, LensGridAxis } from "@/lib/lens-inventory-grid";
import { axisHasInventoryRecords } from "@/lib/lens-inventory-grid";
import type { LensInventoryCell } from "@/lib/types";

export type LensSizeModalRequest =
  | { mode: "add"; axis: LensGridAxis }
  | { mode: "delete"; axis: LensGridAxis; value: string }
  | { mode: "restore"; axis: LensGridAxis; value: string }
  | { mode: "restoreList" };

function axisLabelKey(axis: LensGridAxis): string {
  if (axis === "cyl") return "admin.lensInventory.axisCyl";
  if (axis === "minusSph") return "admin.lensInventory.axisMinusSph";
  return "admin.lensInventory.axisPlusSph";
}

function addTitleKey(axis: LensGridAxis): string {
  return axis === "cyl"
    ? "admin.lensInventory.addCylTitle"
    : "admin.lensInventory.addSizeTitle";
}

function addPlaceholderKey(axis: LensGridAxis): string {
  if (axis === "cyl") return "admin.lensInventory.addCylPlaceholder";
  if (axis === "plusSph") return "admin.lensInventory.addPlusPlaceholder";
  return "admin.lensInventory.addMinusPlaceholder";
}

function addHintKey(axis: LensGridAxis): string {
  return axis === "cyl"
    ? "admin.lensInventory.addCylHint"
    : "admin.lensInventory.addSizeHint";
}

function addInfoBodyKey(axis: LensGridAxis): string {
  return axis === "cyl"
    ? "admin.lensInventory.addCylInfoBody"
    : "admin.lensInventory.addSizeInfoBody";
}

export default function LensInventorySizeModal({
  open,
  request,
  items,
  sizeValue,
  hiddenSizes,
  gridSaving,
  onClose,
  onSizeValueChange,
  onConfirm,
  onOpenRestore,
}: {
  open: boolean;
  request: LensSizeModalRequest | null;
  items: LensInventoryCell[];
  sizeValue: string;
  hiddenSizes: DeactivatedCustomSize[];
  gridSaving: boolean;
  onClose: () => void;
  onSizeValueChange: (value: string) => void;
  onConfirm: () => void;
  onOpenRestore: (entry: DeactivatedCustomSize) => void;
}) {
  const { t } = useLocale();
  const [restorePick, setRestorePick] = useState<DeactivatedCustomSize | null>(null);

  useEffect(() => {
    if (!open || gridSaving) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, gridSaving, onClose]);

  useEffect(() => {
    if (!open) setRestorePick(null);
  }, [open, request?.mode]);

  const deleteSoft = useMemo(() => {
    if (!request || request.mode !== "delete") return false;
    return axisHasInventoryRecords(items, request.axis, request.value);
  }, [items, request]);

  if (!open || !request) return null;

  const isPremiumAdd = request.mode === "add";

  const title =
    request.mode === "add"
      ? t(addTitleKey(request.axis))
      : request.mode === "delete"
        ? t("admin.lensInventory.deleteSizeTitle")
        : request.mode === "restore"
          ? t("admin.lensInventory.restoreSizeTitle")
          : t("admin.lensInventory.restoreListTitle");

  const confirmLabel =
    request.mode === "delete"
      ? t("admin.lensInventory.deleteSizeConfirmBtn")
      : request.mode === "restore"
        ? t("admin.lensInventory.restoreSizeConfirmBtn")
        : request.mode === "add"
          ? t("admin.lensInventory.save")
          : t("admin.lensInventory.save");

  const confirmDisabled =
    gridSaving ||
    (request.mode === "add"
      ? !sizeValue.trim()
      : request.mode === "restoreList"
        ? !restorePick
        : false);

  const actionFooter = (
    <>
      <button
        type="button"
        className="admin-lens-size-btn admin-lens-size-btn-cancel"
        disabled={gridSaving}
        onClick={onClose}
      >
        {t("admin.lensInventory.cancel")}
      </button>
      {request.mode === "restoreList" ? (
        <button
          type="button"
          className="admin-lens-size-btn admin-lens-size-btn-gold"
          disabled={!restorePick || gridSaving}
          onClick={() => restorePick && onOpenRestore(restorePick)}
        >
          <RotateCcw size={15} aria-hidden />
          {t("admin.lensInventory.restorePickContinue")}
        </button>
      ) : (
        <button
          type="button"
          className={`admin-lens-size-btn admin-lens-size-btn-gold${
            request.mode === "delete" ? " is-danger" : ""
          }${request.mode === "add" ? " is-save" : ""}`}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {request.mode === "add" && !gridSaving ? (
            <Plus size={16} strokeWidth={2.5} aria-hidden />
          ) : null}
          {gridSaving ? t("admin.lensInventory.saving") : confirmLabel}
        </button>
      )}
    </>
  );

  if (isPremiumAdd) {
    const axis = request.axis;
    return (
      <div
        className="admin-lens-size-overlay"
        role="presentation"
        onClick={gridSaving ? undefined : onClose}
      >
        <div
          className="admin-lens-size-dialog admin-lens-size-dialog--premium"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="admin-lens-size-dialog-close admin-lens-size-dialog-close--corner"
            onClick={onClose}
            disabled={gridSaving}
            aria-label={t("admin.lensInventory.closeModal")}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>

          <div className="admin-lens-size-premium-grid">
            <section className="admin-lens-size-premium-form">
              <h2 className="admin-lens-size-premium-title">{title}</h2>

              <label className="admin-lens-size-field admin-lens-size-field--premium">
                <span>{t("admin.lensInventory.sizeValueLabel")}</span>
                <div className="admin-lens-size-input-wrap">
                  <input
                    className="admin-lens-size-input admin-lens-size-input--premium"
                    value={sizeValue}
                    onChange={(event) => onSizeValueChange(event.target.value)}
                    placeholder={t(addPlaceholderKey(axis))}
                    dir="ltr"
                    autoFocus
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>
              </label>
              <p className="admin-lens-size-dialog-note admin-lens-size-premium-hint">
                {t(addHintKey(axis))}
              </p>

              <footer className="admin-lens-size-dialog-actions admin-lens-size-premium-actions">
                {actionFooter}
              </footer>
            </section>

            <aside className="admin-lens-size-premium-aside" aria-hidden={false}>
              <div className="admin-lens-size-art-frame">
                <LensSizeModalIllustration />
              </div>
              <div className="admin-lens-size-info-panel">
                <div className="admin-lens-size-info-head">
                  <span className="admin-lens-size-info-icon" aria-hidden>
                    <Info size={15} strokeWidth={2.2} />
                  </span>
                  <strong>{t("admin.lensInventory.addSizeInfoTitle")}</strong>
                </div>
                <p>{t(addInfoBodyKey(axis))}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (request.mode === "delete") {
    return (
      <div
        className="admin-lens-size-overlay"
        role="presentation"
        onClick={gridSaving ? undefined : onClose}
      >
        <div
          className="admin-lens-size-dialog admin-lens-size-dialog--premium admin-lens-size-dialog--confirm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="admin-lens-size-dialog-close admin-lens-size-dialog-close--corner"
            onClick={onClose}
            disabled={gridSaving}
            aria-label={t("admin.lensInventory.closeModal")}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>

          <div className="admin-lens-size-confirm-body">
            <span className="admin-lens-size-confirm-icon" aria-hidden>
              <Trash2 size={22} strokeWidth={1.8} />
            </span>
            <h2 className="admin-lens-size-premium-title admin-lens-size-confirm-title">
              {title}
            </h2>
            <p className="admin-lens-size-confirm-axis">{t(axisLabelKey(request.axis))}</p>
            <p className="admin-lens-size-confirm-value" dir="ltr">
              {request.value}
            </p>
            <p className="admin-lens-size-dialog-lead">
              {deleteSoft
                ? t("admin.lensInventory.deleteSizeBodyStock", {
                    value: request.value,
                  })
                : t("admin.lensInventory.deleteSizeBodyPermanent", {
                    value: request.value,
                  })}
            </p>
            <p className="admin-lens-size-dialog-note">
              {t("admin.lensInventory.deleteSizeConfirmHint")}
            </p>
            <footer className="admin-lens-size-dialog-actions admin-lens-size-confirm-actions">
              {actionFooter}
            </footer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="admin-lens-size-overlay"
      role="presentation"
      onClick={gridSaving ? undefined : onClose}
    >
      <div
        className="admin-lens-size-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-lens-size-dialog-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="admin-lens-size-dialog-close"
            onClick={onClose}
            disabled={gridSaving}
            aria-label={t("admin.lensInventory.closeModal")}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="admin-lens-size-dialog-body">
          {request.mode === "restore" ? (
            <>
              <p className="admin-lens-size-dialog-lead">
                {t("admin.lensInventory.restoreSizeBody", { value: request.value })}
              </p>
              <p className="admin-lens-size-dialog-meta">
                {t(axisLabelKey(request.axis))}
              </p>
            </>
          ) : null}

          {request.mode === "restoreList" ? (
            <>
              <p className="admin-lens-size-dialog-lead">
                {t("admin.lensInventory.restoreListBody")}
              </p>
              <ul className="admin-lens-restore-list">
                {hiddenSizes.map((entry) => {
                  const active =
                    restorePick?.axis === entry.axis &&
                    restorePick?.value === entry.value;
                  return (
                    <li key={`${entry.axis}:${entry.value}`}>
                      <button
                        type="button"
                        className={`admin-lens-restore-pick${active ? " is-active" : ""}`}
                        onClick={() => setRestorePick(entry)}
                      >
                        <span className="admin-lens-restore-pick-value" dir="ltr">
                          {entry.value}
                        </span>
                        <span className="admin-lens-restore-pick-axis">
                          {t(axisLabelKey(entry.axis))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>

        <footer className="admin-lens-size-dialog-actions">{actionFooter}</footer>
      </div>
    </div>
  );
}

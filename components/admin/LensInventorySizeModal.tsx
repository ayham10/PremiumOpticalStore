"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { DeactivatedCustomSize, LensGridAxis } from "@/lib/lens-inventory-grid";
import { axisHasStock } from "@/lib/lens-inventory-grid";
import type { LensInventoryCell } from "@/lib/types";

export type LensSizeModalRequest =
  | { mode: "add"; axis: LensGridAxis }
  | { mode: "edit"; axis: LensGridAxis; from: string }
  | { mode: "delete"; axis: LensGridAxis; value: string }
  | { mode: "restore"; axis: LensGridAxis; value: string }
  | { mode: "restoreList" };

function axisLabelKey(axis: LensGridAxis): string {
  if (axis === "cyl") return "admin.lensInventory.axisCyl";
  if (axis === "minusSph") return "admin.lensInventory.axisMinusSph";
  return "admin.lensInventory.axisPlusSph";
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

  const deleteHasStock = useMemo(() => {
    if (!request || request.mode !== "delete") return false;
    return axisHasStock(items, request.axis, request.value);
  }, [items, request]);

  if (!open || !request) return null;

  const title =
    request.mode === "add"
      ? t("admin.lensInventory.addSizeTitle")
      : request.mode === "edit"
        ? t("admin.lensInventory.editSizeTitle")
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
        : t("admin.lensInventory.save");

  const confirmDisabled =
    gridSaving ||
    (request.mode === "add" || request.mode === "edit"
      ? !sizeValue.trim()
      : request.mode === "restoreList"
        ? !restorePick
        : false);

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
          {request.mode === "delete" ? (
            <>
              <p className="admin-lens-size-dialog-lead">
                {deleteHasStock
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
            </>
          ) : null}

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

          {request.mode === "add" || request.mode === "edit" ? (
            <>
              <label className="admin-lens-size-field">
                <span>{t("admin.lensInventory.sizeValueLabel")}</span>
                <input
                  className="admin-lens-size-input"
                  value={sizeValue}
                  onChange={(event) => onSizeValueChange(event.target.value)}
                  placeholder={t("admin.lensInventory.sizeValuePlaceholder")}
                  dir="ltr"
                  autoFocus
                />
              </label>
              <p className="admin-lens-size-dialog-note">
                {t("admin.lensInventory.sizeValueHint")}
              </p>
            </>
          ) : null}
        </div>

        <footer className="admin-lens-size-dialog-actions">
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
              }`}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {gridSaving ? t("admin.lensInventory.saving") : confirmLabel}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

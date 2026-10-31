"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  LENS_SPH_ONLY_CYL,
  lensSignLabel,
  lensStockTone,
} from "@/lib/lens-inventory";
import {
  effectiveCylColumns,
  isCustomCyl,
  isCustomMinusSph,
  isCustomPlusSph,
  type LensGridAxis,
} from "@/lib/lens-inventory-grid";
import {
  lensCellToCoord,
  moveLensCoord,
  moveLensEditTarget,
  parseLensQtyInput,
  tabLensCoord,
  viewedLensCell,
  type LensDraftMap,
  type LensEditField,
  type LensGridCoord,
} from "@/lib/lens-inventory-edit";
import { lensCellKey } from "@/lib/lens-inventory";
import type { LensInventoryCell, LensInventoryCustomGrid, LensInventorySign } from "@/lib/types";

import type { LensSizeModalRequest } from "@/components/admin/LensInventorySizeModal";

export type { LensSizeModalRequest };

type ActiveCell = {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  field: LensEditField;
};

function isCustomSph(type: LensInventorySign, sph: string, grid: LensInventoryCustomGrid): boolean {
  return type === "minus" ? isCustomMinusSph(sph, grid) : isCustomPlusSph(sph, grid);
}

export default function LensInventoryMatrix({
  title,
  type,
  sphs,
  customGrid,
  items,
  drafts,
  active,
  editText,
  onActivate,
  onEditText,
  onLiveDraft,
  onMove,
  onPasteGrid,
  onCancelCell,
  onCommitBlur,
  onSizeAction,
}: {
  title: string;
  type: LensInventorySign;
  sphs: readonly string[];
  customGrid: LensInventoryCustomGrid;
  items: LensInventoryCell[];
  drafts: LensDraftMap;
  active: ActiveCell | null;
  editText: string;
  onActivate: (
    type: LensInventorySign,
    sph: string,
    cyl: string,
    field: LensEditField,
  ) => void;
  onEditText: (value: string) => void;
  onLiveDraft: (
    type: LensInventorySign,
    sph: string,
    cyl: string,
    field: LensEditField,
    parsed: number,
  ) => void;
  onMove: (next: LensGridCoord | null, field?: LensEditField) => void;
  onPasteGrid: (text: string) => boolean;
  onCancelCell: () => void;
  onCommitBlur: () => boolean;
  onSizeAction: (request: LensSizeModalRequest) => void;
}) {
  const { t } = useLocale();
  const cylColumns = effectiveCylColumns(customGrid);
  const sphAxis: LensGridAxis = type === "minus" ? "minusSph" : "plusSph";

  return (
    <section className="admin-card admin-lens-card" dir="rtl">
      <div className="admin-lens-card-head">
        <h2>{title}</h2>
        <div className="admin-lens-size-toolbar">
          <button
            type="button"
            className="admin-lens-add-size"
            onClick={() => onSizeAction({ mode: "add", axis: sphAxis })}
          >
            <Plus size={14} aria-hidden />
            {t("admin.lensInventory.addSize")}
          </button>
          <button
            type="button"
            className="admin-lens-add-size"
            onClick={() => onSizeAction({ mode: "add", axis: "cyl" })}
          >
            <Plus size={14} aria-hidden />
            {t("admin.lensInventory.addCylColumn")}
          </button>
        </div>
      </div>
      <div className="admin-lens-scroll" dir="ltr">
        <table className="admin-lens-matrix" dir="ltr">
          <colgroup>
            <col className="admin-lens-col-sph" />
            <col className="admin-lens-col-sph-only" />
            {cylColumns.map((cyl) => (
              <col key={cyl} className="admin-lens-col-cyl" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">SPH/CYL</th>
              <th scope="col">SPH</th>
              {cylColumns.map((cyl) => (
                <th key={cyl} scope="col">
                  <span className="admin-lens-axis-label">{cyl}</span>
                  {isCustomCyl(cyl, customGrid) ? (
                    <span className="admin-lens-axis-actions">
                      <button
                        type="button"
                        className="admin-lens-axis-btn admin-lens-axis-btn--delete"
                        aria-label={t("admin.lensInventory.deleteSize")}
                        onClick={() =>
                          onSizeAction({ mode: "delete", axis: "cyl", value: cyl })
                        }
                      >
                        <Trash2 size={11} strokeWidth={2} aria-hidden />
                      </button>
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sphs.map((sph) => (
              <tr key={sph}>
                <th scope="row">
                  <span className="admin-lens-axis-label">{sph}</span>
                  {isCustomSph(type, sph, customGrid) ? (
                    <span className="admin-lens-axis-actions">
                      <button
                        type="button"
                        className="admin-lens-axis-btn admin-lens-axis-btn--delete"
                        aria-label={t("admin.lensInventory.deleteSize")}
                        onClick={() =>
                          onSizeAction({ mode: "delete", axis: sphAxis, value: sph })
                        }
                      >
                        <Trash2 size={11} strokeWidth={2} aria-hidden />
                      </button>
                    </span>
                  ) : null}
                </th>
                <LensStockCell
                  type={type}
                  sph={sph}
                  cyl={LENS_SPH_ONLY_CYL}
                  customGrid={customGrid}
                  items={items}
                  drafts={drafts}
                  active={active}
                  editText={editText}
                  onActivate={onActivate}
                  onEditText={onEditText}
                  onLiveDraft={onLiveDraft}
                  onMove={onMove}
                  onPasteGrid={onPasteGrid}
                  onCancelCell={onCancelCell}
                  onCommitBlur={onCommitBlur}
                  ariaExtra="SPH"
                />
                {cylColumns.map((cyl) => (
                  <LensStockCell
                    key={cyl}
                    type={type}
                    sph={sph}
                    cyl={cyl}
                    customGrid={customGrid}
                    items={items}
                    drafts={drafts}
                    active={active}
                    editText={editText}
                    onActivate={onActivate}
                    onEditText={onEditText}
                    onLiveDraft={onLiveDraft}
                    onMove={onMove}
                    onPasteGrid={onPasteGrid}
                    onCancelCell={onCancelCell}
                    onCommitBlur={onCommitBlur}
                    ariaExtra={cyl}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LensStockCell({
  type,
  sph,
  cyl,
  customGrid,
  items,
  drafts,
  active,
  editText,
  onActivate,
  onEditText,
  onLiveDraft,
  onMove,
  onPasteGrid,
  onCancelCell,
  onCommitBlur,
  ariaExtra,
}: {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  customGrid: LensInventoryCustomGrid;
  items: LensInventoryCell[];
  drafts: LensDraftMap;
  active: ActiveCell | null;
  editText: string;
  onActivate: (
    type: LensInventorySign,
    sph: string,
    cyl: string,
    field: LensEditField,
  ) => void;
  onEditText: (value: string) => void;
  onLiveDraft: (
    type: LensInventorySign,
    sph: string,
    cyl: string,
    field: LensEditField,
    parsed: number,
  ) => void;
  onMove: (next: LensGridCoord | null, field?: LensEditField) => void;
  onPasteGrid: (text: string) => boolean;
  onCancelCell: () => void;
  onCommitBlur: () => boolean;
  ariaExtra: string;
}) {
  const { t } = useLocale();
  const viewed = viewedLensCell(items, drafts, type, sph, cyl);
  const tone = lensStockTone(viewed.currentStock, viewed.desiredStock);
  const dirty = Boolean(drafts[lensCellKey(type, sph, cyl)]);
  const isActive =
    active?.type === type && active.sph === sph && active.cyl === cyl;
  const coord = lensCellToCoord(type, sph, cyl, customGrid);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      onMove(coord ? tabLensCoord(coord, event.shiftKey, customGrid) : null, active?.field);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onMove(
        coord ? moveLensCoord(coord, event.shiftKey ? -1 : 1, 0, customGrid) : null,
        active?.field,
      );
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelCell();
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      onActivate(type, sph, cyl, active?.field === "desired" ? "current" : "desired");
      return;
    }
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      if (!coord) return;
      const next = moveLensEditTarget(
        coord,
        active?.field ?? "current",
        event.key,
        true,
        customGrid,
      );
      if (!next) return;
      if (
        next.coord.type === coord.type &&
        next.coord.row === coord.row &&
        next.coord.col === coord.col
      ) {
        onActivate(type, sph, cyl, next.field);
        return;
      }
      onMove(next.coord, next.field);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (text.includes("\t") || text.includes("\n") || text.includes("/")) {
      if (onPasteGrid(text)) event.preventDefault();
    }
  }

  function onQtyChange(value: string, field: LensEditField) {
    if (value !== "" && !/^\d{0,4}$/.test(value)) return;
    onEditText(value);
    const parsed = value === "" ? 0 : parseLensQtyInput(value);
    if (parsed == null) return;
    onLiveDraft(type, sph, cyl, field, parsed);
  }

  if (isActive && active) {
    const currentValue =
      active.field === "current" ? editText : String(viewed.currentStock);
    const desiredValue =
      active.field === "desired" ? editText : String(viewed.desiredStock);
    return (
      <td>
        <div
          className={`admin-lens-cell is-${tone}${dirty ? " is-dirty" : ""} is-editing`}
          aria-label={`${t("admin.lensInventory.editTitle")} ${lensSignLabel(type)} ${sph} ${ariaExtra}`}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              onCommitBlur();
            }
          }}
        >
          <input
            className="admin-lens-qty-input"
            data-lens-input={`${type}:${sph}:${cyl}:current`}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={4}
            value={currentValue}
            aria-label={t("admin.lensInventory.colCurrent")}
            onChange={(event) => {
              if (active.field !== "current") onActivate(type, sph, cyl, "current");
              onQtyChange(event.target.value, "current");
            }}
            onFocus={() => {
              if (active.field !== "current") onActivate(type, sph, cyl, "current");
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          <span className="admin-lens-cell-slash">/</span>
          <input
            className="admin-lens-qty-input"
            data-lens-input={`${type}:${sph}:${cyl}:desired`}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={4}
            value={desiredValue}
            aria-label={t("admin.lensInventory.colDesired")}
            onChange={(event) => {
              if (active.field !== "desired") onActivate(type, sph, cyl, "desired");
              onQtyChange(event.target.value, "desired");
            }}
            onFocus={() => {
              if (active.field !== "desired") onActivate(type, sph, cyl, "desired");
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </div>
      </td>
    );
  }

  return (
    <td>
      <button
        type="button"
        className={`admin-lens-cell is-${tone}${dirty ? " is-dirty" : ""}`}
        onClick={() => onActivate(type, sph, cyl, "current")}
        onDoubleClick={() => onActivate(type, sph, cyl, "desired")}
        aria-label={`${t("admin.lensInventory.editTitle")} ${lensSignLabel(type)} ${sph} ${ariaExtra}`}
      >
        {viewed.currentStock}/{viewed.desiredStock}
      </button>
    </td>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Contact, Download, Printer } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ApiError, apiFetch } from "@/lib/admin-api";
import { formatLocalPhone } from "@/lib/format";
import LensInventoryMatrix, {
  type LensSizeModalRequest,
} from "@/components/admin/LensInventoryMatrix";
import {
  buildLensOrderRows,
  lensCellKey,
  lensOrderTotals,
} from "@/lib/lens-inventory";
import {
  effectiveMinusSph,
  effectivePlusSph,
  emptyLensInventoryCustomGrid,
} from "@/lib/lens-inventory-grid";
import {
  LENS_ORDER_SHEET_CSS,
  buildLensOrderSheetHtml,
} from "@/lib/lens-order-sheet";
import {
  applyLensPaste,
  draftsToWriteItems,
  lensCellToCoord,
  lensCoordToCell,
  lensDraftCount,
  parseLensPasteGrid,
  parseLensQtyInput,
  setLensDraft,
  tabLensCoord,
  viewedLensCell,
  viewedLensItems,
  type LensDraftMap,
  type LensEditField,
  type LensGridCoord,
} from "@/lib/lens-inventory-edit";
import type {
  LensInventoryCell,
  LensInventoryCustomGrid,
  LensInventorySign,
} from "@/lib/types";

type ActiveCell = {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  field: LensEditField;
};

function inputSelector(cell: ActiveCell): string {
  return `input[data-lens-input="${cell.type}:${cell.sph}:${cell.cyl}:${cell.field}"]`;
}

export default function AdminLensInventoryPage() {
  const { t } = useLocale();
  const { settings } = useBranding();
  const { notifySaved } = useAdminSuccessNotice();
  const [items, setItems] = useState<LensInventoryCell[]>([]);
  const [customGrid, setCustomGrid] = useState<LensInventoryCustomGrid>(
    emptyLensInventoryCustomGrid(),
  );
  const [sizeModal, setSizeModal] = useState<LensSizeModalRequest | null>(null);
  const [sizeValue, setSizeValue] = useState("");
  const [gridSaving, setGridSaving] = useState(false);
  const [drafts, setDrafts] = useState<LensDraftMap>({});
  const [undoStack, setUndoStack] = useState<LensDraftMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [editText, setEditText] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [includePhone, setIncludePhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const draftsRef = useRef(drafts);
  const itemsRef = useRef(items);
  const activeRef = useRef(active);
  const editTextRef = useRef(editText);
  const customGridRef = useRef(customGrid);
  customGridRef.current = customGrid;
  draftsRef.current = drafts;
  itemsRef.current = items;
  activeRef.current = active;
  editTextRef.current = editText;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{
        items: LensInventoryCell[];
        customGrid?: LensInventoryCustomGrid;
      }>("/api/lens-inventory");
      setItems(Array.isArray(data.items) ? data.items : []);
      setCustomGrid(
        data.customGrid
          ? { ...emptyLensInventoryCustomGrid(), ...data.customGrid }
          : emptyLensInventoryCustomGrid(),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.lensInventory.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector<HTMLInputElement>(inputSelector(active));
    el?.focus();
    el?.select();
  }, [active]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (lensDraftCount(draftsRef.current) === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const viewedItems = useMemo(
    () => viewedLensItems(items, drafts),
    [items, drafts],
  );
  const orderRows = useMemo(
    () => buildLensOrderRows(viewedItems, customGrid),
    [viewedItems, customGrid],
  );
  const totals = useMemo(() => lensOrderTotals(orderRows), [orderRows]);
  const dirtyCount = lensDraftCount(drafts);

  const typedInCellRef = useRef(false);

  const pushUndo = useCallback((snapshot?: LensDraftMap) => {
    setUndoStack((stack) => [...stack.slice(-49), snapshot ?? draftsRef.current]);
  }, []);

  const commitActive = useCallback(
    (raw = editTextRef.current): boolean => {
      const cell = activeRef.current;
      if (!cell) return true;
      const parsed = raw.trim() === "" ? 0 : parseLensQtyInput(raw);
      if (parsed == null) {
        setError(t("admin.lensInventory.invalidQty"));
        return false;
      }
      const next = setLensDraft(
        draftsRef.current,
        itemsRef.current,
        cell.type,
        cell.sph,
        cell.cyl,
        cell.field === "current"
          ? { currentStock: parsed }
          : { desiredStock: parsed },
      );
      if (JSON.stringify(next) !== JSON.stringify(draftsRef.current)) {
        pushUndo();
        draftsRef.current = next;
        setDrafts(next);
      }
      setError("");
      return true;
    },
    [pushUndo, t],
  );

  const activate = useCallback(
    (type: LensInventorySign, sph: string, cyl: string, field: LensEditField) => {
      const current = activeRef.current;
      if (
        current &&
        (current.type !== type ||
          current.sph !== sph ||
          current.cyl !== cyl ||
          current.field !== field) &&
        !commitActive()
      ) {
        return;
      }
      const viewed = viewedLensCell(itemsRef.current, draftsRef.current, type, sph, cyl);
      typedInCellRef.current = false;
      setActive({ type, sph, cyl, field });
      setEditText(
        String(field === "current" ? viewed.currentStock : viewed.desiredStock),
      );
      setError("");
    },
    [commitActive],
  );

  const liveDraft = useCallback(
    (
      type: LensInventorySign,
      sph: string,
      cyl: string,
      field: LensEditField,
      parsed: number,
    ) => {
      if (!typedInCellRef.current) {
        pushUndo();
        typedInCellRef.current = true;
      }
      setDrafts((current) => {
        const next = setLensDraft(current, itemsRef.current, type, sph, cyl, {
          [field === "current" ? "currentStock" : "desiredStock"]: parsed,
        });
        draftsRef.current = next;
        return next;
      });
    },
    [pushUndo],
  );

  const moveActive = useCallback(
    (next: LensGridCoord | null, field?: LensEditField) => {
      if (!next) return;
      if (!commitActive()) return;
      const cell = lensCoordToCell(next, customGridRef.current);
      if (!cell) return;
      activate(cell.type, cell.sph, cell.cyl, field ?? "current");
    },
    [activate, commitActive],
  );

  const onPasteGrid = useCallback(
    (text: string) => {
      const cell = activeRef.current;
      if (!cell) return false;
      const origin = lensCellToCoord(cell.type, cell.sph, cell.cyl, customGridRef.current);
      if (!origin) return false;
      const grid = parseLensPasteGrid(text);
      if (!grid.length) return false;
      if (!commitActive()) return false;
      pushUndo();
      const nextDrafts = applyLensPaste(
        draftsRef.current,
        itemsRef.current,
        origin,
        grid,
        customGridRef.current,
      );
      draftsRef.current = nextDrafts;
      setDrafts(nextDrafts);
      setError("");
      const viewed = viewedLensCell(
        itemsRef.current,
        nextDrafts,
        cell.type,
        cell.sph,
        cell.cyl,
      );
      setEditText(
        String(cell.field === "current" ? viewed.currentStock : viewed.desiredStock),
      );
      return true;
    },
    [commitActive, pushUndo],
  );

  const undoChanges = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) {
        draftsRef.current = {};
        setDrafts({});
        return stack;
      }
      const previous = stack[stack.length - 1];
      draftsRef.current = previous;
      setDrafts(previous);
      return stack.slice(0, -1);
    });
    setActive(null);
    setError("");
  }, []);

  const cancelAll = useCallback(() => {
    draftsRef.current = {};
    setDrafts({});
    setUndoStack([]);
    setActive(null);
    setError("");
  }, []);

  const cancelActiveCell = useCallback(() => {
    const cell = activeRef.current;
    if (!cell) return;
    const key = lensCellKey(cell.type, cell.sph, cell.cyl);
    if (draftsRef.current[key]) {
      pushUndo();
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        draftsRef.current = next;
        return next;
      });
    }
    setActive(null);
    setError("");
  }, [pushUndo]);

  async function saveChanges() {
    if (!commitActive()) return;
    const writes = draftsToWriteItems(itemsRef.current, draftsRef.current);
    if (!writes.length) {
      setActive(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await apiFetch<{
        items: LensInventoryCell[];
      }>("/api/lens-inventory", {
        method: "PUT",
        body: JSON.stringify({ items: writes }),
      });
      setItems(Array.isArray(saved.items) ? saved.items : []);
      draftsRef.current = {};
      setDrafts({});
      setUndoStack([]);
      setActive(null);
      notifySaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const latest = await apiFetch<{ items: LensInventoryCell[] }>(
            "/api/lens-inventory",
          );
          const latestItems = Array.isArray(latest.items) ? latest.items : [];
          itemsRef.current = latestItems;
          setItems(latestItems);
          const conflicts = Array.isArray(
            (err.body as { conflicts?: Array<{ type: string; sph: string; cyl: string }> })
              ?.conflicts,
          )
            ? (err.body as { conflicts: Array<{ type: string; sph: string; cyl: string }> })
                .conflicts
            : [];
          setDrafts((current) => {
            const next = { ...current };
            for (const row of conflicts) {
              delete next[lensCellKey(row.type as LensInventorySign, row.sph, row.cyl)];
            }
            draftsRef.current = next;
            return next;
          });
        } catch {
          /* keep local drafts */
        }
        setError(t("admin.lensInventory.conflictError"));
      } else {
        setError(
          err instanceof Error ? err.message : t("admin.lensInventory.saveError"),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName) && dirtyCount === 0) {
          return;
        }
        event.preventDefault();
        undoChanges();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveChanges();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function storePhonePrefill(): string {
    return formatLocalPhone(settings?.phone) || settings?.phone?.trim() || "";
  }

  function exportPhone(): string | null {
    if (!includePhone) return null;
    const value = phoneDraft.trim();
    return value || null;
  }

  function openSizeModal(request: LensSizeModalRequest) {
    setSizeModal(request);
    setSizeValue(
      request.mode === "edit" ? request.from : request.mode === "delete" ? request.value : "",
    );
    setError("");
  }

  async function submitSizeModal() {
    if (!sizeModal) return;
    setGridSaving(true);
    setError("");
    try {
      let body: Record<string, string>;
      if (sizeModal.mode === "add") {
        body = { action: "add", axis: sizeModal.axis, value: sizeValue };
      } else if (sizeModal.mode === "edit") {
        body = {
          action: "edit",
          axis: sizeModal.axis,
          from: sizeModal.from,
          to: sizeValue,
        };
      } else {
        body = { action: "delete", axis: sizeModal.axis, value: sizeModal.value };
      }
      const saved = await apiFetch<{
        items: LensInventoryCell[];
        customGrid: LensInventoryCustomGrid;
      }>("/api/lens-inventory/grid", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setItems(Array.isArray(saved.items) ? saved.items : []);
      setCustomGrid(saved.customGrid ?? emptyLensInventoryCustomGrid());
      setSizeModal(null);
      setSizeValue("");
      notifySaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.lensInventory.gridSaveError"),
      );
    } finally {
      setGridSaving(false);
    }
  }

  function openExportModal() {
    const stored = storePhonePrefill();
    setPhoneDraft(stored);
    setIncludePhone(false);
    setExportOpen(true);
  }

  async function exportOrderPdf(mode: "download" | "print") {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    setError("");
    try {
      const { downloadLensOrderPdf, printLensOrderPdf } = await import(
        "@/lib/lens-order-pdf-download"
      );
      if (mode === "print") {
        await printLensOrderPdf(orderRows, { phone: exportPhone() });
      } else {
        await downloadLensOrderPdf(orderRows, { phone: exportPhone() });
      }
      setExportOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.lensInventory.downloadError"),
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="admin-lens-page" dir="rtl">
      <AdminPageHeader
        icon={Contact}
        kicker={t("admin.lensInventory.kicker")}
        title={t("admin.lensInventory.title")}
        description={t("admin.lensInventory.description")}
        actions={
          dirtyCount ? (
            <div className="admin-lens-bulk-actions">
              <p className="admin-lens-dirty-count">
                {t("admin.lensInventory.dirtyCount", { n: dirtyCount })}
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={undoChanges}
                disabled={saving || !undoStack.length}
              >
                {t("admin.lensInventory.undo")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelAll}
                disabled={saving}
              >
                {t("admin.lensInventory.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => void saveChanges()}
                disabled={saving}
              >
                {saving
                  ? t("admin.lensInventory.saving")
                  : t("admin.lensInventory.saveChanges")}
              </button>
            </div>
          ) : null
        }
      />

      {error ? <p className="admin-lens-error">{error}</p> : null}

      {loading ? (
        <p className="admin-muted">{t("admin.lensInventory.loading")}</p>
      ) : (
        <>
          <div className="admin-lens-matrices" dir="ltr">
            <LensInventoryMatrix
              title={t("admin.lensInventory.minusTitle")}
              type="minus"
              sphs={effectiveMinusSph(customGrid)}
              customGrid={customGrid}
              items={items}
              drafts={drafts}
              active={active}
              editText={editText}
              onActivate={activate}
              onEditText={setEditText}
              onLiveDraft={liveDraft}
              onMove={moveActive}
              onPasteGrid={onPasteGrid}
              onCancelCell={cancelActiveCell}
              onCommitBlur={commitActive}
              onSizeAction={openSizeModal}
            />
            <LensInventoryMatrix
              title={t("admin.lensInventory.plusTitle")}
              type="plus"
              sphs={effectivePlusSph(customGrid)}
              customGrid={customGrid}
              items={items}
              drafts={drafts}
              active={active}
              editText={editText}
              onActivate={activate}
              onEditText={setEditText}
              onLiveDraft={liveDraft}
              onMove={moveActive}
              onPasteGrid={onPasteGrid}
              onCancelCell={cancelActiveCell}
              onCommitBlur={commitActive}
              onSizeAction={openSizeModal}
            />
          </div>

          <section className="admin-card admin-lens-legend" aria-label={t("admin.lensInventory.legendTitle")}>
            <h2>{t("admin.lensInventory.legendTitle")}</h2>
            <ul>
              <li>
                <span className="admin-lens-swatch is-green" />
                {t("admin.lensInventory.legendGreen")}
              </li>
              <li>
                <span className="admin-lens-swatch is-gold" />
                {t("admin.lensInventory.legendGold")}
              </li>
              <li>
                <span className="admin-lens-swatch is-red" />
                {t("admin.lensInventory.legendRed")}
              </li>
              <li>
                <span className="admin-lens-swatch is-neutral" />
                {t("admin.lensInventory.legendNeutral")}
              </li>
            </ul>
          </section>

          <section className="admin-card admin-lens-order">
            <div className="admin-lens-order-head">
              <div>
                <h2>
                  <button
                    type="button"
                    className={`admin-lens-order-toggle${orderOpen ? " is-open" : ""}`}
                    aria-expanded={orderOpen}
                    aria-controls="admin-lens-order-table"
                    onClick={() => setOrderOpen((open) => !open)}
                  >
                    <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
                    <span>{t("admin.lensInventory.orderTitle")}</span>
                  </button>
                </h2>
                <p>
                  {t("admin.lensInventory.totalRequired")}:{" "}
                  <strong>{totals.requiredQuantity}</strong>
                  <span className="admin-lens-order-sep">·</span>
                  {t("admin.lensInventory.totalQty")}: <strong>{totals.quantity}</strong>
                </p>
              </div>
              <div className="admin-lens-order-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={openExportModal}
                  disabled={downloadingPdf}
                >
                  <Download size={15} />
                  {t("admin.lensInventory.download")}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={openExportModal}
                >
                  <Printer size={15} />
                  {t("admin.lensInventory.print")}
                </button>
              </div>
            </div>

            {orderOpen ? (
              orderRows.length === 0 ? (
                <p className="admin-muted">{t("admin.lensInventory.orderEmpty")}</p>
              ) : (
                <div className="admin-lens-order-wrap" id="admin-lens-order-table">
                  <style>{LENS_ORDER_SHEET_CSS}</style>
                  <div
                    className="admin-lens-order-preview"
                    dangerouslySetInnerHTML={{
                      __html: buildLensOrderSheetHtml(orderRows),
                    }}
                  />
                </div>
              )
            ) : null}
          </section>
        </>
      )}

      <AdminModal
        open={Boolean(sizeModal)}
        title={
          sizeModal?.mode === "add"
            ? t("admin.lensInventory.addSizeTitle")
            : sizeModal?.mode === "edit"
              ? t("admin.lensInventory.editSizeTitle")
              : t("admin.lensInventory.deleteSizeTitle")
        }
        onClose={() => {
          if (gridSaving) return;
          setSizeModal(null);
        }}
      >
        {sizeModal?.mode === "delete" ? (
          <p className="admin-muted">{t("admin.lensInventory.deleteSizeBody")}</p>
        ) : (
          <>
            <label className="admin-field">
              <span>{t("admin.lensInventory.sizeValueLabel")}</span>
              <input
                className="admin-input"
                value={sizeValue}
                onChange={(event) => setSizeValue(event.target.value)}
                placeholder={t("admin.lensInventory.sizeValuePlaceholder")}
                dir="ltr"
              />
            </label>
            <p className="admin-muted">{t("admin.lensInventory.sizeValueHint")}</p>
          </>
        )}
        <div className="admin-modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={gridSaving}
            onClick={() => setSizeModal(null)}
          >
            {t("admin.lensInventory.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={gridSaving || (sizeModal?.mode !== "delete" && !sizeValue.trim())}
            onClick={() => void submitSizeModal()}
          >
            {gridSaving
              ? t("admin.lensInventory.saving")
              : sizeModal?.mode === "delete"
                ? t("admin.lensInventory.deleteSizeConfirmBtn")
                : t("admin.lensInventory.save")}
          </button>
        </div>
      </AdminModal>

      <AdminModal
        open={exportOpen}
        title={t("admin.lensInventory.exportTitle")}
        onClose={() => {
          if (!downloadingPdf) setExportOpen(false);
        }}
        preventClose={downloadingPdf}
        icon={<Download size={16} strokeWidth={1.8} aria-hidden />}
      >
        <label className="admin-lens-export-check">
          <input
            type="checkbox"
            checked={includePhone}
            onChange={(event) => {
              const next = event.target.checked;
              setIncludePhone(next);
              if (next && !phoneDraft.trim()) setPhoneDraft(storePhonePrefill());
            }}
          />
          <span>{t("admin.lensInventory.includePhone")}</span>
        </label>
        {includePhone ? (
          <label className="admin-lens-export-phone">
            <span>{t("admin.lensInventory.phoneLabel")}</span>
            <input
              type="tel"
              dir="ltr"
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value)}
              placeholder={t("admin.lensInventory.phonePlaceholder")}
              autoComplete="off"
            />
            <small>{t("admin.lensInventory.phoneHint")}</small>
          </label>
        ) : null}
        <div className="admin-lens-export-actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void exportOrderPdf("download")}
            disabled={downloadingPdf}
          >
            <Download size={15} />
            {downloadingPdf
              ? t("admin.lensInventory.downloading")
              : t("admin.lensInventory.exportDownload")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void exportOrderPdf("print")}
            disabled={downloadingPdf}
          >
            <Printer size={15} />
            {t("admin.lensInventory.exportPrint")}
          </button>
        </div>
      </AdminModal>
    </div>
  );
}

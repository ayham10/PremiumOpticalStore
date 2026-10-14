"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { ChevronDown, Contact, Download, Printer } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ApiError, apiFetch } from "@/lib/admin-api";
import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_PLUS_SPH,
  LENS_SPH_ONLY_CYL,
  buildLensOrderDocumentHtml,
  buildLensOrderRows,
  formatLensCylDisplay,
  lensCellKey,
  lensOrderTotals,
  lensSignLabel,
  lensStockTone,
  type LensOrderRow,
} from "@/lib/lens-inventory";
import {
  applyLensPaste,
  draftsToWriteItems,
  lensCellToCoord,
  lensCoordToCell,
  lensDraftCount,
  moveLensCoord,
  moveLensEditTarget,
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
import type { LensInventoryCell, LensInventorySign } from "@/lib/types";

type ActiveCell = {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  field: LensEditField;
};

function printWhenFontsReady(win: Window | null) {
  if (!win) return;
  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };
  const fonts = win.document.fonts;
  if (fonts?.ready) {
    void fonts.ready.then(go, go);
  }
  setTimeout(go, 1200);
}

function openOrderDocument(html: string, print: boolean) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    if (print) printWhenFontsReady(popup);
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  if (print) printWhenFontsReady(iframe.contentWindow);
  setTimeout(() => iframe.remove(), 4000);
}

function downloadOrderDocument(html: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oyon-lens-order-${stamp}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function inputSelector(cell: ActiveCell): string {
  return `input[data-lens-input="${cell.type}:${cell.sph}:${cell.cyl}:${cell.field}"]`;
}

export default function AdminLensInventoryPage() {
  const { t } = useLocale();
  const { notifySaved } = useAdminSuccessNotice();
  const [items, setItems] = useState<LensInventoryCell[]>([]);
  const [drafts, setDrafts] = useState<LensDraftMap>({});
  const [undoStack, setUndoStack] = useState<LensDraftMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [editText, setEditText] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const draftsRef = useRef(drafts);
  const itemsRef = useRef(items);
  const activeRef = useRef(active);
  const editTextRef = useRef(editText);
  draftsRef.current = drafts;
  itemsRef.current = items;
  activeRef.current = active;
  editTextRef.current = editText;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ items: LensInventoryCell[] }>(
        "/api/lens-inventory",
      );
      setItems(Array.isArray(data.items) ? data.items : []);
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
  const orderRows = useMemo(() => buildLensOrderRows(viewedItems), [viewedItems]);
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
      const cell = lensCoordToCell(next);
      if (!cell) return;
      activate(cell.type, cell.sph, cell.cyl, field ?? "current");
    },
    [activate, commitActive],
  );

  const onPasteGrid = useCallback(
    (text: string) => {
      const cell = activeRef.current;
      if (!cell) return false;
      const origin = lensCellToCoord(cell.type, cell.sph, cell.cyl);
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

  function exportOrder(print: boolean) {
    const html = buildLensOrderDocumentHtml(orderRows);
    if (print) openOrderDocument(html, true);
    else downloadOrderDocument(html);
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
            <LensMatrix
              title={t("admin.lensInventory.minusTitle")}
              type="minus"
              sphs={LENS_MINUS_SPH}
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
            />
            <LensMatrix
              title={t("admin.lensInventory.plusTitle")}
              type="plus"
              sphs={LENS_PLUS_SPH}
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
                  {t("admin.lensInventory.totalItems")}: <strong>{totals.combinations}</strong>
                  <span className="admin-lens-order-sep">·</span>
                  {t("admin.lensInventory.totalQty")}: <strong>{totals.quantity}</strong>
                </p>
              </div>
              <div className="admin-lens-order-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => exportOrder(false)}
                >
                  <Download size={15} />
                  {t("admin.lensInventory.download")}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => exportOrder(true)}
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
                <div className="admin-lens-order-wrap" id="admin-lens-order-table" dir="ltr">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>SPH</th>
                        <th>CYL</th>
                        <th dir="rtl">{t("admin.lensInventory.colCurrent")}</th>
                        <th dir="rtl">{t("admin.lensInventory.colDesired")}</th>
                        <th dir="rtl">{t("admin.lensInventory.colOrder")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderRows.map((row, index) => (
                        <OrderRowView
                          key={`${row.type}-${row.sph}-${row.cyl}`}
                          row={row}
                          index={index + 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function OrderRowView({ row, index }: { row: LensOrderRow; index: number }) {
  return (
    <tr>
      <td>{index}</td>
      <td className="admin-lens-ltr">{row.sph}</td>
      <td className="admin-lens-ltr">{formatLensCylDisplay(row.cyl)}</td>
      <td>{row.currentStock}</td>
      <td>{row.desiredStock}</td>
      <td className="admin-lens-qty">{row.quantityToOrder}</td>
    </tr>
  );
}

function LensStockCell({
  type,
  sph,
  cyl,
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
  const coord = lensCellToCoord(type, sph, cyl);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      onMove(coord ? tabLensCoord(coord, event.shiftKey) : null, active?.field);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onMove(
        coord ? moveLensCoord(coord, event.shiftKey ? -1 : 1, 0) : null,
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
            onBlur={() => {
              /* commit when leaving the cell entirely */
            }}
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

function LensMatrix({
  title,
  type,
  sphs,
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
}: {
  title: string;
  type: LensInventorySign;
  sphs: readonly string[];
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
}) {
  return (
    <section className="admin-card admin-lens-card" dir="rtl">
      <h2>{title}</h2>
      <div className="admin-lens-scroll" dir="ltr">
        <table className="admin-lens-matrix" dir="ltr">
          <colgroup>
            <col className="admin-lens-col-sph" />
            <col className="admin-lens-col-sph-only" />
            {LENS_CYL.map((cyl) => (
              <col key={cyl} className="admin-lens-col-cyl" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">SPH/CYL</th>
              <th scope="col">SPH</th>
              {LENS_CYL.map((cyl) => (
                <th key={cyl} scope="col">
                  {cyl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sphs.map((sph) => (
              <tr key={sph}>
                <th scope="row">{sph}</th>
                <LensStockCell
                  type={type}
                  sph={sph}
                  cyl={LENS_SPH_ONLY_CYL}
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
                {LENS_CYL.map((cyl) => (
                  <LensStockCell
                    key={cyl}
                    type={type}
                    sph={sph}
                    cyl={cyl}
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

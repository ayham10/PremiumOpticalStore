"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Contact, Download, Printer } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_PLUS_SPH,
  buildLensOrderDocumentHtml,
  buildLensOrderRows,
  getLensCell,
  lensOrderTotals,
  lensSignLabel,
  lensStockTone,
  parseLensQty,
  type LensOrderRow,
} from "@/lib/lens-inventory";
import type { LensInventoryCell, LensInventorySign } from "@/lib/types";

type Editor = {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  currentStock: string;
  desiredStock: string;
};

function openOrderDocument(html: string, print: boolean) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    if (print) {
      popup.focus();
      setTimeout(() => popup.print(), 250);
    }
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
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => iframe.remove(), 1000);
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

export default function AdminLensInventoryPage() {
  const { t } = useLocale();
  const { notifySaved } = useAdminSuccessNotice();
  const [items, setItems] = useState<LensInventoryCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);

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

  const orderRows = useMemo(() => buildLensOrderRows(items), [items]);
  const totals = useMemo(() => lensOrderTotals(orderRows), [orderRows]);

  function openCell(type: LensInventorySign, sph: string, cyl: string) {
    const cell = getLensCell(items, type, sph, cyl);
    setEditor({
      type,
      sph,
      cyl,
      currentStock: String(cell.currentStock),
      desiredStock: String(cell.desiredStock),
    });
    setError("");
  }

  async function saveCell() {
    if (!editor) return;
    const currentStock = parseLensQty(editor.currentStock);
    const desiredStock = parseLensQty(editor.desiredStock);
    if (currentStock == null || desiredStock == null) {
      setError(t("admin.lensInventory.invalidQty"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await apiFetch<{
        item: LensInventoryCell;
        items: LensInventoryCell[];
      }>("/api/lens-inventory", {
        method: "PUT",
        body: JSON.stringify({
          type: editor.type,
          sph: editor.sph,
          cyl: editor.cyl,
          currentStock,
          desiredStock,
        }),
      });
      setItems(Array.isArray(saved.items) ? saved.items : []);
      setEditor(null);
      notifySaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.lensInventory.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

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
      />

      {error && !editor ? (
        <p className="admin-lens-error">{error}</p>
      ) : null}

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
              onEdit={openCell}
            />
            <LensMatrix
              title={t("admin.lensInventory.plusTitle")}
              type="plus"
              sphs={LENS_PLUS_SPH}
              items={items}
              onEdit={openCell}
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
                <h2>{t("admin.lensInventory.orderTitle")}</h2>
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

            {orderRows.length === 0 ? (
              <p className="admin-muted">{t("admin.lensInventory.orderEmpty")}</p>
            ) : (
              <div className="admin-lens-order-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("admin.lensInventory.colType")}</th>
                      <th>SPH</th>
                      <th>CYL</th>
                      <th>{t("admin.lensInventory.colCurrent")}</th>
                      <th>{t("admin.lensInventory.colDesired")}</th>
                      <th>{t("admin.lensInventory.colOrder")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((row, index) => (
                      <OrderRowView key={`${row.type}-${row.sph}-${row.cyl}`} row={row} index={index + 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <AdminModal
        compact
        className="admin-lens-edit-modal"
        open={Boolean(editor)}
        title={t("admin.lensInventory.editTitle")}
        onClose={() => {
          if (!saving) setEditor(null);
        }}
      >
        {editor ? (
          <form
            className="admin-lens-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCell();
            }}
          >
            <div className="admin-lens-edit-meta">
              <p>
                <span>{t("admin.lensInventory.colType")}</span>
                <strong>{lensSignLabel(editor.type)}</strong>
              </p>
              <p>
                <span>SPH</span>
                <strong dir="ltr">{editor.sph}</strong>
              </p>
              <p>
                <span>CYL</span>
                <strong dir="ltr">{editor.cyl}</strong>
              </p>
            </div>
            <label>
              <span>{t("admin.lensInventory.colCurrent")}</span>
              <input
                className="input"
                inputMode="numeric"
                min={0}
                max={9999}
                maxLength={4}
                step={1}
                value={editor.currentStock}
                onChange={(event) =>
                  setEditor({ ...editor, currentStock: event.target.value })
                }
              />
            </label>
            <label>
              <span>{t("admin.lensInventory.colDesired")}</span>
              <input
                className="input"
                inputMode="numeric"
                min={0}
                max={9999}
                maxLength={4}
                step={1}
                value={editor.desiredStock}
                onChange={(event) =>
                  setEditor({ ...editor, desiredStock: event.target.value })
                }
              />
            </label>
            {error ? <p className="admin-lens-error">{error}</p> : null}
            <div className="admin-lens-edit-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditor(null)}
                disabled={saving}
              >
                {t("admin.lensInventory.cancel")}
              </button>
              <button type="submit" className="btn btn-accent" disabled={saving}>
                {saving
                  ? t("admin.lensInventory.saving")
                  : t("admin.lensInventory.save")}
              </button>
            </div>
          </form>
        ) : null}
      </AdminModal>
    </div>
  );
}

function OrderRowView({ row, index }: { row: LensOrderRow; index: number }) {
  return (
    <tr>
      <td>{index}</td>
      <td>{lensSignLabel(row.type)}</td>
      <td>{row.sph}</td>
      <td>{row.cyl}</td>
      <td>{row.currentStock}</td>
      <td>{row.desiredStock}</td>
      <td className="admin-lens-qty">{row.quantityToOrder}</td>
    </tr>
  );
}

function LensMatrix({
  title,
  type,
  sphs,
  items,
  onEdit,
}: {
  title: string;
  type: LensInventorySign;
  sphs: readonly string[];
  items: LensInventoryCell[];
  onEdit: (type: LensInventorySign, sph: string, cyl: string) => void;
}) {
  const { t } = useLocale();
  return (
    <section className="admin-card admin-lens-card" dir="rtl">
      <h2>{title}</h2>
      <div className="admin-lens-scroll" dir="ltr">
        <table className="admin-lens-matrix" dir="ltr">
          <colgroup>
            <col className="admin-lens-col-sph" />
            {LENS_CYL.map((cyl) => (
              <col key={cyl} className="admin-lens-col-cyl" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">SPH \ CYL</th>
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
                {LENS_CYL.map((cyl) => {
                  const cell = getLensCell(items, type, sph, cyl);
                  const tone = lensStockTone(cell.currentStock, cell.desiredStock);
                  return (
                    <td key={cyl}>
                      <button
                        type="button"
                        className={`admin-lens-cell is-${tone}`}
                        onClick={() => onEdit(type, sph, cyl)}
                        aria-label={`${t("admin.lensInventory.editTitle")} ${lensSignLabel(type)} ${sph} ${cyl}`}
                      >
                        {cell.currentStock}/{cell.desiredStock}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import type { LensInventoryCell, LensInventorySign } from "@/lib/types";

export const LENS_MINUS_SPH = [
  "PLANO",
  "-0.25",
  "-0.50",
  "-0.75",
  "-1.00",
  "-1.25",
  "-1.50",
  "-1.75",
  "-2.00",
  "-2.25",
  "-2.50",
  "-2.75",
  "-3.00",
  "-3.25",
  "-3.50",
  "-3.75",
  "-4.00",
  "-4.50",
] as const;

export const LENS_PLUS_SPH = [
  "+0.25",
  "+0.50",
  "+0.75",
  "+1.00",
  "+1.25",
  "+1.50",
  "+1.75",
  "+2.00",
  "+2.25",
  "+2.50",
  "+2.75",
  "+3.00",
  "+3.25",
  "+3.50",
  "+3.75",
  "+4.00",
  "+4.25",
  "+4.50",
  "+4.75",
] as const;

export const LENS_CYL = [
  "-0.25",
  "-0.50",
  "-0.75",
  "-1.00",
  "-1.25",
  "-1.50",
  "-1.75",
  "-2.00",
] as const;

/** Spherical-only stock. Distinct from CYL columns so existing SPH/CYL cells never collide. */
export const LENS_SPH_ONLY_CYL = "0.00";

export type LensMinusSph = (typeof LENS_MINUS_SPH)[number];
export type LensPlusSph = (typeof LENS_PLUS_SPH)[number];
export type LensCyl = (typeof LENS_CYL)[number];
export type LensStockTone = "green" | "gold" | "red" | "neutral";

export interface LensOrderRow {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  currentStock: number;
  desiredStock: number;
  quantityToOrder: number;
}

const MINUS_SPH = new Set<string>(LENS_MINUS_SPH);
const PLUS_SPH = new Set<string>(LENS_PLUS_SPH);
const CYL = new Set<string>(LENS_CYL);

export function lensCellKey(
  type: LensInventorySign,
  sph: string,
  cyl: string,
): string {
  return `${type}:${sph}:${cyl}`;
}

export function isLensInventorySign(value: unknown): value is LensInventorySign {
  return value === "minus" || value === "plus";
}

export function isAllowedSph(type: LensInventorySign, sph: string): boolean {
  return type === "minus" ? MINUS_SPH.has(sph) : PLUS_SPH.has(sph);
}

export function isSphOnlyCyl(cyl: string): boolean {
  return cyl === LENS_SPH_ONLY_CYL;
}

export function isAllowedCyl(cyl: string): boolean {
  return isSphOnlyCyl(cyl) || CYL.has(cyl);
}

export function formatLensCylDisplay(cyl: string): string {
  return isSphOnlyCyl(cyl) ? "—" : cyl;
}

/** Order list / PDF / print show SPH-only as 0.00, matching the CYL sequence. */
export function formatLensOrderCyl(cyl: string): string {
  return isSphOnlyCyl(cyl) ? LENS_SPH_ONLY_CYL : cyl;
}

export const LENS_ORDER_CYL_SEQUENCE = [LENS_SPH_ONLY_CYL, ...LENS_CYL] as const;

export type LensOrderSectionId = "negative" | "positive";

export type LensOrderDisplayItem =
  | { kind: "section"; id: LensOrderSectionId }
  | { kind: "row"; row: LensOrderRow; index: number };

const CYL_ORDER = new Map<string, number>(
  LENS_ORDER_CYL_SEQUENCE.map((cyl, index) => [cyl, index]),
);
const MINUS_SPH_ORDER = new Map<string, number>(
  LENS_MINUS_SPH.map((sph, index) => [sph, index]),
);
const PLUS_SPH_ORDER = new Map<string, number>(
  LENS_PLUS_SPH.map((sph, index) => [sph, index]),
);

export function lensOrderSection(
  row: Pick<LensOrderRow, "type">,
): LensOrderSectionId {
  return row.type === "plus" ? "positive" : "negative";
}

/**
 * Shared order-list sort: negative SPH + PLANO, then positive SPH.
 * Within each section, CYL is 0.00 → -0.25 → …; SPH is PLANO → more minus,
 * or smallest plus → largest plus.
 */
export function compareLensOrderRows(
  a: Pick<LensOrderRow, "type" | "sph" | "cyl">,
  b: Pick<LensOrderRow, "type" | "sph" | "cyl">,
): number {
  const sectionA = lensOrderSection(a) === "negative" ? 0 : 1;
  const sectionB = lensOrderSection(b) === "negative" ? 0 : 1;
  if (sectionA !== sectionB) return sectionA - sectionB;
  const cylA = CYL_ORDER.get(a.cyl) ?? 999;
  const cylB = CYL_ORDER.get(b.cyl) ?? 999;
  if (cylA !== cylB) return cylA - cylB;
  if (sectionA === 0) {
    return (
      (MINUS_SPH_ORDER.get(a.sph) ?? 999) - (MINUS_SPH_ORDER.get(b.sph) ?? 999)
    );
  }
  return (PLUS_SPH_ORDER.get(a.sph) ?? 999) - (PLUS_SPH_ORDER.get(b.sph) ?? 999);
}

export function sortLensOrderRows<T extends Pick<LensOrderRow, "type" | "sph" | "cyl">>(
  rows: T[],
): T[] {
  return [...rows].sort(compareLensOrderRows);
}

export function buildLensOrderDisplayItems(
  rows: LensOrderRow[],
): LensOrderDisplayItem[] {
  const items: LensOrderDisplayItem[] = [];
  let index = 0;
  let last: LensOrderSectionId | null = null;
  for (const row of rows) {
    const id = lensOrderSection(row);
    if (id !== last) {
      items.push({ kind: "section", id });
      last = id;
    }
    index += 1;
    items.push({ kind: "row", row, index });
  }
  return items;
}

export const LENS_ORDER_PDF_FILENAME = "רשימת הזמנות.pdf";
export const LENS_ORDER_WEBSITE = "www.oyonoptics.com";
export const LENS_ORDER_LOCATION_HE = "דיר חנא";

export function lensOrderPdfFilename(_date = new Date()): string {
  return LENS_ORDER_PDF_FILENAME;
}

export function lensOrderSectionMark(id: LensOrderSectionId): "−" | "+" {
  return id === "negative" ? "−" : "+";
}

export function parseLensQty(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

export function quantityToOrder(currentStock: number, desiredStock: number): number {
  return Math.max(desiredStock - currentStock, 0);
}

export function lensStockTone(
  currentStock: number,
  desiredStock: number,
): LensStockTone {
  if (desiredStock <= 0) return "neutral";
  if (currentStock <= 0) return "red";
  if (currentStock < desiredStock) return "gold";
  return "green";
}

export function lensSignLabel(type: LensInventorySign): string {
  return type === "minus" ? "(-)" : "(+)";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function sanitizeLensInventoryCell(
  value: unknown,
): LensInventoryCell | null {
  const row = asRecord(value);
  if (!isLensInventorySign(row.type)) return null;
  const sph = typeof row.sph === "string" ? row.sph.trim() : "";
  const cyl = typeof row.cyl === "string" ? row.cyl.trim() : "";
  if (!isAllowedSph(row.type, sph) || !isAllowedCyl(cyl)) return null;
  const currentStock = parseLensQty(row.currentStock);
  const desiredStock = parseLensQty(row.desiredStock);
  if (currentStock == null || desiredStock == null) return null;
  const updatedAt =
    typeof row.updatedAt === "string" && row.updatedAt
      ? row.updatedAt
      : new Date().toISOString();
  return {
    type: row.type,
    sph,
    cyl,
    currentStock,
    desiredStock,
    updatedAt,
  };
}

export function normalizeLensInventory(raw: unknown): LensInventoryCell[] {
  const map = new Map<string, LensInventoryCell>();
  if (!Array.isArray(raw)) return [];
  for (const row of raw) {
    const cell = sanitizeLensInventoryCell(row);
    if (!cell) continue;
    map.set(lensCellKey(cell.type, cell.sph, cell.cyl), cell);
  }
  return [...map.values()];
}

export function upsertLensInventoryCell(
  items: LensInventoryCell[],
  next: LensInventoryCell,
): LensInventoryCell[] {
  const key = lensCellKey(next.type, next.sph, next.cyl);
  const without = items.filter(
    (item) => lensCellKey(item.type, item.sph, item.cyl) !== key,
  );
  if (next.currentStock === 0 && next.desiredStock === 0) return without;
  return [...without, next];
}

export function getLensCell(
  items: LensInventoryCell[],
  type: LensInventorySign,
  sph: string,
  cyl: string,
): { currentStock: number; desiredStock: number } {
  const found = items.find(
    (item) => item.type === type && item.sph === sph && item.cyl === cyl,
  );
  return {
    currentStock: found?.currentStock ?? 0,
    desiredStock: found?.desiredStock ?? 0,
  };
}

export function buildLensOrderRows(items: LensInventoryCell[]): LensOrderRow[] {
  const rows: LensOrderRow[] = [];
  const tables: Array<{ type: LensInventorySign; sphs: readonly string[] }> = [
    { type: "minus", sphs: LENS_MINUS_SPH },
    { type: "plus", sphs: LENS_PLUS_SPH },
  ];
  for (const table of tables) {
    for (const sph of table.sphs) {
      for (const cyl of LENS_ORDER_CYL_SEQUENCE) {
        const { currentStock, desiredStock } = getLensCell(
          items,
          table.type,
          sph,
          cyl,
        );
        const qty = quantityToOrder(currentStock, desiredStock);
        if (qty > 0) {
          rows.push({
            type: table.type,
            sph,
            cyl,
            currentStock,
            desiredStock,
            quantityToOrder: qty,
          });
        }
      }
    }
  }
  return sortLensOrderRows(rows);
}

export function lensOrderTotals(rows: LensOrderRow[]): {
  combinations: number;
  quantity: number;
  requiredQuantity: number;
} {
  return {
    combinations: rows.length,
    quantity: rows.reduce((sum, row) => sum + row.quantityToOrder, 0),
    requiredQuantity: rows.reduce((sum, row) => sum + row.desiredStock, 0),
  };
}

export function formatLensOrderDate(value = new Date()): string {
  return value.toLocaleDateString("he", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeLensOrderText(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function lensOrderSectionTitle(
  id: LensOrderSectionId,
  _locale: "en" | "he" | "ar" = "en",
): string {
  return lensOrderSectionMark(id);
}

export type LensOrderDocumentOptions = {
  generatedAt?: Date;
  phone?: string | null;
};

export function buildLensOrderDocumentHtml(
  rows: LensOrderRow[],
  generatedAtOrOptions: Date | LensOrderDocumentOptions = new Date(),
): string {
  const options: LensOrderDocumentOptions =
    generatedAtOrOptions instanceof Date
      ? { generatedAt: generatedAtOrOptions }
      : generatedAtOrOptions;
  const generatedAt = options.generatedAt ?? new Date();
  const phone = options.phone?.trim() || "";
  const totals = lensOrderTotals(rows);
  const items = buildLensOrderDisplayItems(rows);
  const body = items
    .map((item) => {
      if (item.kind === "section") {
        return `
        <tr class="section">
          <td class="section-cell" colspan="6">${escapeLensOrderText(
            lensOrderSectionMark(item.id),
          )}</td>
        </tr>`;
      }
      const { row, index } = item;
      return `
        <tr>
          <td class="num">${index}</td>
          <td class="ltr">${escapeLensOrderText(row.sph)}</td>
          <td class="ltr">${escapeLensOrderText(formatLensOrderCyl(row.cyl))}</td>
          <td class="num">${row.desiredStock}</td>
          <td class="num">${row.currentStock}</td>
          <td class="qty">${row.quantityToOrder}</td>
        </tr>`;
    })
    .join("");

  const phoneLine = phone
    ? `<p class="footer-phone" dir="ltr">${escapeLensOrderText(phone)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>רשימת הזמנה לעדשות</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Noto+Naskh+Arabic:wght@600&family=Noto+Sans+Hebrew:wght@400;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Noto Sans Hebrew", "Arial Hebrew", "David", "Arial", sans-serif;
    }
    h1, p { margin: 0; }
    .sheet { max-width: 190mm; margin: 0 auto; }
    .header { text-align: center; }
    .logo {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: #111;
      line-height: 1;
    }
    .logo-en {
      font-family: Fraunces, Georgia, serif;
      font-size: 11.2px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-indent: 0.28em;
    }
    .logo-ar-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 42px;
    }
    .logo-line {
      flex: 1;
      height: 1px;
      background: #222;
    }
    .logo-ar {
      font-family: "Noto Naskh Arabic", serif;
      font-size: 7.2px;
      font-weight: 600;
    }
    .title {
      margin-top: 6px;
      font-size: 15px;
      font-weight: 800;
    }
    .meta {
      margin-top: 4px;
      font-size: 10.5px;
      color: #222;
    }
    .rule {
      height: 1px;
      margin: 8px 0 7px;
      background: #222;
    }
    .order-table-wrap { direction: ltr; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      direction: ltr;
      unicode-bidi: isolate;
    }
    col.idx { width: 8%; }
    col.sph { width: 14%; }
    col.cyl { width: 14%; }
    col.required { width: 22%; }
    col.current { width: 20%; }
    col.order { width: 22%; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      border: 0.4pt solid #666;
      padding: 5px 6px;
      text-align: center;
      font-size: 11px;
      line-height: 1.35;
      vertical-align: middle;
    }
    th {
      background: #1a1a1a;
      color: #fff;
      font-weight: 700;
    }
    tr.section td {
      background: #ececec;
      color: #111;
      font-weight: 800;
      font-size: 13px;
      text-align: center;
    }
    tbody tr:nth-child(even):not(.section) td { background: #f3f3f3; }
    tbody tr:nth-child(odd):not(.section) td { background: #fff; }
    td.ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    td.num, td.qty { font-variant-numeric: tabular-nums; }
    td.qty { font-weight: 800; }
    .footer {
      margin-top: 12px;
      font-size: 10px;
      color: #222;
      text-align: center;
    }
    .footer-web { direction: ltr; unicode-bidi: isolate; }
    .footer-phone { margin-top: 3px; font-variant-numeric: tabular-nums; }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <div class="logo" aria-label="OYON">
        <span class="logo-en">OYON</span>
        <span class="logo-ar-row">
          <span class="logo-line"></span>
          <span class="logo-ar">عيون</span>
          <span class="logo-line"></span>
        </span>
      </div>
      <h1 class="title">רשימת הזמנה לעדשות</h1>
      <p class="meta">${escapeLensOrderText(formatLensOrderDate(generatedAt))}</p>
      <p class="meta">סה״כ כמות נדרשת: ${totals.requiredQuantity} | סה״כ כמות להזמנה: ${totals.quantity}</p>
    </header>
    <div class="rule"></div>
    <div class="order-table-wrap">
    <table>
      <colgroup>
        <col class="idx" />
        <col class="sph" />
        <col class="cyl" />
        <col class="required" />
        <col class="current" />
        <col class="order" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>SPH</th>
          <th>CYL</th>
          <th dir="rtl">כמות נדרשת</th>
          <th dir="rtl">מלאי נוכחי</th>
          <th dir="rtl">כמות להזמנה</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="6">אין פריטים להזמנה</td></tr>`}</tbody>
    </table>
    </div>
    <div class="footer">
      <p>${escapeLensOrderText(LENS_ORDER_LOCATION_HE)} · <span class="footer-web">${escapeLensOrderText(LENS_ORDER_WEBSITE)}</span></p>
      ${phoneLine}
    </div>
  </div>
</body>
</html>`;
}

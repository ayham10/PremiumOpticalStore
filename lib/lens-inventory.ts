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
      for (const cyl of [LENS_SPH_ONLY_CYL, ...LENS_CYL]) {
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
  return rows;
}

export function lensOrderTotals(rows: LensOrderRow[]): {
  combinations: number;
  quantity: number;
} {
  return {
    combinations: rows.length,
    quantity: rows.reduce((sum, row) => sum + row.quantityToOrder, 0),
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

export function buildLensOrderDocumentHtml(
  rows: LensOrderRow[],
  generatedAt = new Date(),
): string {
  const totals = lensOrderTotals(rows);
  const body = rows
    .map(
      (row, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td>${escapeLensOrderText(lensSignLabel(row.type))}</td>
          <td class="ltr">${escapeLensOrderText(row.sph)}</td>
          <td class="ltr">${escapeLensOrderText(formatLensCylDisplay(row.cyl))}</td>
          <td class="qty">${row.quantityToOrder}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>OYON OPTICS — רשימת הזמנה לעדשות</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1a1f26;
      font-family: "Noto Sans Hebrew", "Arial Hebrew", "David", "Arial", sans-serif;
    }
    body { padding: 0; }
    h1, p { margin: 0; }
    .sheet { max-width: 190mm; margin: 0 auto; }
    .header { text-align: right; }
    .brand {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #0b1722;
    }
    .title {
      margin-top: 2px;
      font-size: 16px;
      font-weight: 700;
      color: #0b1722;
    }
    .date { margin-top: 3px; font-size: 11px; color: #4b5560; }
    .rule {
      height: 1px;
      margin: 8px 0 7px;
      background: #d4af6a;
    }
    .summary {
      margin: 0 0 8px;
      font-size: 11.5px;
      color: #2a3138;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    col.idx { width: 8%; }
    col.kind { width: 18%; }
    col.sph { width: 16%; }
    col.cyl { width: 16%; }
    col.order { width: 42%; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      border: 1px solid #c5ccd3;
      padding: 5px 6px;
      text-align: center;
      font-size: 11px;
      line-height: 1.35;
      vertical-align: middle;
    }
    th {
      background: #0b1722;
      color: #f4f7fa;
      font-weight: 700;
    }
    tbody tr:nth-child(even) td { background: #f4f6f8; }
    tbody tr:nth-child(odd) td { background: #fff; }
    td.ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    td.num { font-variant-numeric: tabular-nums; }
    td.qty {
      color: #b8862b;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .total {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #0b1722;
    }
    .footer {
      margin-top: 10px;
      font-size: 10px;
      letter-spacing: 0.08em;
      color: #8a929c;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      <p class="brand">OYON OPTICS</p>
      <h1 class="title">רשימת הזמנה לעדשות</h1>
      <p class="date">${escapeLensOrderText(formatLensOrderDate(generatedAt))}</p>
    </header>
    <div class="rule"></div>
    <p class="summary">סה״כ שורות: ${totals.combinations} | סה״כ להזמנה: ${totals.quantity}</p>
    <table>
      <colgroup>
        <col class="idx" />
        <col class="kind" />
        <col class="sph" />
        <col class="cyl" />
        <col class="order" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>סוג עדשה</th>
          <th>SPH</th>
          <th>CYL</th>
          <th>כמות להזמנה</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="5">אין פריטים להזמנה</td></tr>`}</tbody>
    </table>
    <p class="total">סה״כ כמות להזמנה: ${totals.quantity}</p>
    <p class="footer">OYON OPTICS</p>
  </div>
</body>
</html>`;
}

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

export function isAllowedCyl(cyl: string): boolean {
  return CYL.has(cyl);
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
      for (const cyl of LENS_CYL) {
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
  return value.toLocaleDateString("ar", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildLensOrderDocumentHtml(
  rows: LensOrderRow[],
  generatedAt = new Date(),
): string {
  const totals = lensOrderTotals(rows);
  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${lensSignLabel(row.type)}</td>
          <td>${row.sph}</td>
          <td>${row.cyl}</td>
          <td class="qty">${row.quantityToOrder}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>OYON OPTICS — طلبية عدسات</title>
  <style>
    @page { size: A4; margin: 16mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Noto Sans Arabic", "Arial", sans-serif;
    }
    body { padding: 8mm 4mm; }
    h1, h2, p { margin: 0; }
    .header { margin-bottom: 18px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; }
    .title { margin-top: 4px; font-size: 18px; font-weight: 700; }
    .date { margin-top: 8px; font-size: 13px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td {
      border: 1px solid #222;
      padding: 8px 10px;
      text-align: right;
      font-size: 13px;
    }
    th { background: #f3f3f3; font-weight: 700; }
    td.qty, th.qty { font-weight: 800; text-align: center; }
    .totals { margin-top: 18px; font-size: 14px; }
    .totals p { margin: 4px 0; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <header class="header">
    <p class="brand">OYON OPTICS</p>
    <h1 class="title">طلبية عدسات</h1>
    <p class="date">${formatLensOrderDate(generatedAt)}</p>
  </header>
  <table>
    <thead>
      <tr>
        <th>نوع العدسة</th>
        <th>SPH</th>
        <th>CYL</th>
        <th class="qty">كمية الطلب</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="4">لا توجد أصناف للطلب</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <p>إجمالي الأصناف: ${totals.combinations}</p>
    <p>إجمالي الكمية: ${totals.quantity}</p>
  </div>
</body>
</html>`;
}

import {
  LENS_ORDER_BRAND_EN,
  LENS_ORDER_BRAND_HE,
  LENS_ORDER_COL_CYL,
  LENS_ORDER_COL_INDEX,
  LENS_ORDER_COL_QTY,
  LENS_ORDER_COL_SPH,
  LENS_ORDER_LOCATION_EN,
  LENS_ORDER_LOCATION_HE,
  LENS_ORDER_LOGO_SRC,
  LENS_ORDER_TITLE,
  LENS_ORDER_WEBSITE,
  buildLensOrderDisplayItems,
  formatLensOrderCyl,
  formatLensOrderNumericDate,
  lensOrderSectionMark,
  lensOrderTotals,
  type LensOrderDocumentOptions,
  type LensOrderRow,
} from "@/lib/lens-inventory";

function escapeText(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PHONE_SVG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#111" d="M7.2 3.2h2.4c.5 0 .9.3 1 .8l.7 2.6c.1.4 0 .8-.3 1.1L9.6 9.9a12.4 12.4 0 0 0 4.5 4.5l2.2-1.4c.3-.2.7-.3 1.1-.2l2.6.7c.5.1.8.5.8 1v2.4c0 1.1-.9 2-2.1 1.9C9.8 18.2 5.8 14.2 5.2 5.3c-.1-1.2.8-2.1 2-2.1Z"/>
</svg>`;

const PIN_SVG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#111" d="M12 2.5c3.6 0 6.5 2.8 6.5 6.3 0 4.7-6.5 12.7-6.5 12.7S5.5 13.5 5.5 8.8C5.5 5.3 8.4 2.5 12 2.5Zm0 8.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z"/>
</svg>`;

const GLOBE_SVG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="8.2" fill="none" stroke="#111" stroke-width="1.7"/>
  <ellipse cx="12" cy="12" rx="3.4" ry="8.2" fill="none" stroke="#111" stroke-width="1.5"/>
  <path d="M4.2 12h15.6M5.4 8.2h13.2M5.4 15.8h13.2" fill="none" stroke="#111" stroke-width="1.5"/>
</svg>`;

export const LENS_ORDER_SHEET_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap");
.lens-order-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 210mm;
  margin: 0 auto;
  padding: 9mm 8mm 8mm;
  background: #fff;
  color: #111;
  border: 1.4px solid #111;
  outline: 0.9px solid #111;
  outline-offset: 2.4px;
  font-family: Heebo, "Noto Sans Hebrew", Arial, sans-serif;
}
.lens-order-sheet * { box-sizing: border-box; }
.lens-order-sheet h1, .lens-order-sheet p { margin: 0; }
.lens-order-head {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 8px 16px;
  align-items: start;
}
.lens-order-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-self: end;
  width: max-content;
  color: #111;
  line-height: 1;
}
.lens-order-brand .logo {
  display: block;
  width: 148px;
  max-width: 100%;
  height: auto;
}
.lens-order-title-block {
  text-align: right;
  padding-top: 2px;
}
.lens-order-title-block h1 {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.15;
}
.lens-order-title-rule {
  width: 96px;
  height: 1.15px;
  margin: 5px 0 7px auto;
  background: #111;
}
.lens-order-date, .lens-order-business {
  font-size: 10.5px;
  font-weight: 700;
}
.lens-order-business { margin-top: 3px; }
.lens-order-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 7px 0;
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
  font-size: 10.5px;
  font-weight: 700;
}
.lens-order-phone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 800;
  direction: rtl;
}
.lens-order-phone .icon { width: 13px; height: 13px; flex: 0 0 auto; }
.lens-order-phone .num { direction: ltr; unicode-bidi: isolate; }
.lens-order-totals { text-align: right; }
.lens-order-table-wrap {
  margin-top: 7px;
  direction: ltr;
}
.lens-order-sheet table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.lens-order-sheet col.idx { width: 10%; }
.lens-order-sheet col.sph { width: 29%; }
.lens-order-sheet col.cyl { width: 29%; }
.lens-order-sheet col.qty { width: 32%; }
.lens-order-sheet thead { display: table-header-group; }
.lens-order-sheet tr { break-inside: avoid; page-break-inside: avoid; }
.lens-order-sheet th, .lens-order-sheet td {
  border: 0.4pt solid #c4c4c4;
  padding: 6px 5px;
  text-align: center;
  font-size: 11px;
  line-height: 1.3;
  vertical-align: middle;
}
.lens-order-sheet th {
  background: #000;
  color: #fff;
  font-weight: 800;
  border-color: #fff;
}
.lens-order-sheet th .en {
  font-family: Heebo, Arial, sans-serif;
  letter-spacing: 0.02em;
}
.lens-order-sheet tr.section td {
  background: #e8e8e8;
  padding: 5px 8px;
  text-align: left;
  direction: ltr;
  border-color: #c4c4c4;
}
.lens-order-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #111;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}
.lens-order-sheet tbody tr:nth-child(even):not(.section) td { background: #f5f5f5; }
.lens-order-sheet tbody tr:nth-child(odd):not(.section) td { background: #fff; }
.lens-order-sheet td.ltr {
  direction: ltr;
  unicode-bidi: isolate;
  font-variant-numeric: tabular-nums;
}
.lens-order-sheet td.num, .lens-order-sheet td.qty { font-variant-numeric: tabular-nums; }
.lens-order-sheet td.qty { font-weight: 800; }
.lens-order-foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #111;
  direction: ltr;
}
.lens-order-foot-loc, .lens-order-foot-web {
  display: flex;
  align-items: center;
  gap: 7px;
}
.lens-order-foot-web { justify-content: flex-end; }
.lens-order-foot .icon { width: 16px; height: 16px; flex: 0 0 auto; }
.lens-order-foot-name { font-size: 11px; font-weight: 800; }
.lens-order-foot-sub, .lens-order-foot-url {
  font-size: 10px;
  font-weight: 500;
  direction: ltr;
  unicode-bidi: isolate;
}
.lens-order-foot-rule {
  width: 1px;
  height: 26px;
  background: #111;
  justify-self: center;
}
`;

export function buildLensOrderSheetHtml(
  rows: LensOrderRow[],
  options: LensOrderDocumentOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date();
  const phone = options.phone?.trim() || "";
  const totals = lensOrderTotals(rows);
  const items = buildLensOrderDisplayItems(rows);
  const body = items
    .map((item) => {
      if (item.kind === "section") {
        return `<tr class="section"><td class="section-cell" colspan="4"><span class="lens-order-badge">${escapeText(
          lensOrderSectionMark(item.id),
        )}</span></td></tr>`;
      }
      const { row, index } = item;
      return `<tr>
          <td class="num">${index}</td>
          <td class="ltr">${escapeText(row.sph)}</td>
          <td class="ltr">${escapeText(formatLensOrderCyl(row.cyl))}</td>
          <td class="qty">${row.quantityToOrder}</td>
        </tr>`;
    })
    .join("");

  const phoneBlock = phone
    ? `<span class="lens-order-phone">${PHONE_SVG}<span>טלפון: <span class="num">${escapeText(
        phone,
      )}</span></span></span>`
    : `<span></span>`;

  return `<div class="lens-order-sheet" dir="rtl" lang="he">
    <header class="lens-order-head">
      <div class="lens-order-title-block">
        <h1>${escapeText(LENS_ORDER_TITLE)}</h1>
        <div class="lens-order-title-rule"></div>
        <p class="lens-order-date">תאריך הזמנה: ${escapeText(
          formatLensOrderNumericDate(generatedAt),
        )}</p>
        <p class="lens-order-business">שם העסק: ${escapeText(LENS_ORDER_BRAND_HE)}</p>
      </div>
      <div class="lens-order-brand" aria-label="${escapeText(LENS_ORDER_BRAND_EN)}">
        <img class="logo" src="${escapeText(LENS_ORDER_LOGO_SRC)}" alt="${escapeText(LENS_ORDER_BRAND_EN)}" />
      </div>
    </header>
    <div class="lens-order-meta">
      <p class="lens-order-totals">סה״כ כמות נדרשת: ${totals.requiredQuantity} | סה״כ כמות להזמנה: ${totals.quantity}</p>
      ${phoneBlock}
    </div>
    <div class="lens-order-table-wrap">
      <table>
        <colgroup>
          <col class="idx" />
          <col class="sph" />
          <col class="cyl" />
          <col class="qty" />
        </colgroup>
        <thead>
          <tr>
            <th>${escapeText(LENS_ORDER_COL_INDEX)}</th>
            <th><span class="en">SPH</span> (ספירה)</th>
            <th><span class="en">CYL</span> (צילינדר)</th>
            <th>${escapeText(LENS_ORDER_COL_QTY)}</th>
          </tr>
        </thead>
        <tbody>${body || `<tr><td colspan="4">אין פריטים להזמנה</td></tr>`}</tbody>
      </table>
    </div>
    <footer class="lens-order-foot">
      <div class="lens-order-foot-loc">
        ${PIN_SVG}
        <div>
          <div class="lens-order-foot-name">${escapeText(LENS_ORDER_LOCATION_HE)}</div>
          <div class="lens-order-foot-sub">${escapeText(LENS_ORDER_LOCATION_EN)}</div>
        </div>
      </div>
      <div class="lens-order-foot-rule"></div>
      <div class="lens-order-foot-web">
        ${GLOBE_SVG}
        <span class="lens-order-foot-url">${escapeText(LENS_ORDER_WEBSITE)}</span>
      </div>
    </footer>
  </div>`;
}

export function buildLensOrderDocumentHtml(
  rows: LensOrderRow[],
  generatedAtOrOptions: Date | LensOrderDocumentOptions = new Date(),
): string {
  const options: LensOrderDocumentOptions =
    generatedAtOrOptions instanceof Date
      ? { generatedAt: generatedAtOrOptions }
      : generatedAtOrOptions;
  const sheet = buildLensOrderSheetHtml(rows, options);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>רשימת הזמנה לעדשות</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
    }
    ${LENS_ORDER_SHEET_CSS}
    @media print {
      body { padding: 0; }
      .lens-order-sheet {
        max-width: none;
        outline-offset: 0;
      }
    }
  </style>
</head>
<body>
  ${sheet}
</body>
</html>`;
}

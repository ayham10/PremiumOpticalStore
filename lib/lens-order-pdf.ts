import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  LENS_ORDER_BRAND_EN,
  LENS_ORDER_BRAND_HE,
  LENS_ORDER_LOCATION_EN,
  LENS_ORDER_LOCATION_HE,
  LENS_ORDER_PDF_FILENAME,
  LENS_ORDER_WEBSITE,
  buildLensOrderDisplayItems,
  formatLensOrderCyl,
  formatLensOrderNumericDate,
  lensOrderPdfFilename,
  lensOrderTotals,
  type LensOrderRow,
} from "@/lib/lens-inventory";
import { pdfRtlText } from "@/lib/rtl-pdf-text";

export type LensOrderPdfFonts = {
  latin: Uint8Array;
  hebrew: Uint8Array;
  arabic: Uint8Array;
};

export type LensOrderPdfOptions = {
  generatedAt?: Date;
  fonts: LensOrderPdfFonts;
  phone?: string | null;
};

const FONT_LATIN = "NotoSans";
const FONT_HEBREW = "NotoSansHebrew";
const FONT_ARABIC = "NotoNaskhArabic";
const PAGE_W = 210;
const PAGE_H = 297;
const OUTER = 7;
const INNER = 8.4;
const TABLE_TOP = 52;
const INK = [17, 17, 17] as const;
const GOLD = [184, 144, 73] as const;
const GRID = [208, 208, 208] as const;
const HEAD_BG = [17, 17, 17] as const;
const ALT_ROW = [243, 243, 243] as const;
const SECTION_BG = [236, 236, 236] as const;

function binaryStringFromBytes(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return parts.join("");
}

function registerFont(
  doc: jsPDF,
  filename: string,
  family: string,
  bytes: Uint8Array,
  styles: Array<"normal" | "bold"> = ["normal"],
) {
  doc.addFileToVFS(filename, binaryStringFromBytes(bytes));
  for (const style of styles) {
    doc.addFont(filename, family, style);
  }
}

function drawRtlMixed(
  doc: jsPDF,
  logical: string,
  xRight: number,
  y: number,
  size: number,
  hebrewStyle: "normal" | "bold" = "normal",
) {
  const tokens =
    logical.match(
      /[\u0590-\u05FF״׳]+|\d{1,2}\.\d{1,2}\.\d{4}|\d+(?:[.,]\d+)?|[A-Za-z]+(?:\.[a-z]+)+|\s+|[^\s]/g,
    ) || [];
  let x = xRight;
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  for (const token of tokens) {
    const hebrew = /[\u0590-\u05FF]/.test(token);
    if (hebrew) {
      doc.setFont(FONT_HEBREW, hebrewStyle);
      const visual = [...token].reverse().join("");
      const width = doc.getTextWidth(visual);
      x -= width;
      doc.text(visual, x, y);
    } else {
      doc.setFont(FONT_LATIN, hebrewStyle === "bold" ? "bold" : "normal");
      const width = doc.getTextWidth(token);
      x -= width;
      doc.text(token, x, y);
    }
  }
}

function drawEye(doc: jsPDF, cx: number, cy: number) {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.55);
  doc.ellipse(cx, cy, 8.2, 4.1, "S");
  doc.setFillColor(...INK);
  doc.circle(cx, cy, 2.35, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, 0.85, "F");
}

function drawPhoneIcon(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...INK);
  doc.roundedRect(x, y - 2.6, 2.6, 3.6, 0.5, 0.5, "F");
  doc.circle(x + 1.3, y + 1.5, 0.45, "F");
}

function drawPin(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...GOLD);
  doc.circle(x, y - 1.1, 2.15, "F");
  doc.triangle(x - 1.7, y - 0.4, x + 1.7, y - 0.4, x, y + 3.4, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(x, y - 1.2, 0.85, "F");
}

function drawGlobe(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.38);
  doc.circle(x, y, 2.5, "S");
  doc.ellipse(x, y, 1.1, 2.5, "S");
  doc.line(x - 2.5, y, x + 2.5, y);
  doc.line(x - 2.1, y - 1.2, x + 2.1, y - 1.2);
  doc.line(x - 2.1, y + 1.2, x + 2.1, y + 1.2);
}

function drawPageChrome(
  doc: jsPDF,
  generatedAt: Date,
  totals: { requiredQuantity: number; quantity: number },
  phone: string,
) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.85);
  doc.rect(OUTER, OUTER, PAGE_W - OUTER * 2, PAGE_H - OUTER * 2, "S");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.32);
  doc.rect(INNER, INNER, PAGE_W - INNER * 2, PAGE_H - INNER * 2, "S");

  const brandX = 28;
  drawEye(doc, brandX, 16.2);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(LENS_ORDER_BRAND_EN, brandX, 23.4, {
    align: "center",
    charSpace: 0.45,
  });
  doc.setFont(FONT_HEBREW, "bold");
  doc.setFontSize(7.4);
  doc.text(pdfRtlText(LENS_ORDER_BRAND_HE), brandX, 27.4, { align: "center" });

  const right = PAGE_W - INNER - 2;
  drawRtlMixed(doc, "רשימת הזמנה לעדשות", right, 16.8, 13.5, "bold");
  doc.setFillColor(...GOLD);
  doc.rect(right - 32, 18.6, 32, 0.85, "F");
  drawRtlMixed(
    doc,
    `תאריך הזמנה: ${formatLensOrderNumericDate(generatedAt)}`,
    right,
    24.8,
    8.4,
    "bold",
  );

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.32);
  doc.line(INNER + 1.5, 31.5, PAGE_W - INNER - 1.5, 31.5);

  drawRtlMixed(
    doc,
    `סה״כ כמות נדרשת: ${totals.requiredQuantity} | סה״כ כמות להזמנה: ${totals.quantity}`,
    right,
    37.4,
    8.2,
    "bold",
  );
  if (phone) {
    drawPhoneIcon(doc, INNER + 3.2, 37.2);
    drawRtlMixed(doc, `טלפון: ${phone}`, INNER + 38, 37.4, 8.2, "bold");
  }

  doc.setDrawColor(...GOLD);
  doc.line(INNER + 1.5, 41.2, PAGE_W - INNER - 1.5, 41.2);

  const footY = 286;
  doc.setDrawColor(...GOLD);
  doc.line(INNER + 1.5, 278.5, PAGE_W - INNER - 1.5, 278.5);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.32);
  doc.line(PAGE_W / 2, 280.4, PAGE_W / 2, 290.2);

  drawPin(doc, INNER + 6.5, footY);
  doc.setFont(FONT_HEBREW, "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...INK);
  doc.text(pdfRtlText(LENS_ORDER_LOCATION_HE), INNER + 11.2, footY - 0.6);
  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(7.4);
  doc.text(LENS_ORDER_LOCATION_EN, INNER + 11.2, footY + 3.2);

  drawGlobe(doc, PAGE_W - INNER - 42, footY + 0.6);
  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(8);
  doc.text(LENS_ORDER_WEBSITE, PAGE_W - INNER - 37.5, footY + 1.4);
}

function tableBody(rows: LensOrderRow[]): RowInput[] {
  const items = buildLensOrderDisplayItems(rows);
  if (!items.length) {
    return [
      [
        {
          content: pdfRtlText("אין פריטים להזמנה"),
          colSpan: 4,
          styles: {
            halign: "center",
            font: FONT_HEBREW,
            fontStyle: "normal",
          },
        },
      ],
    ];
  }
  return items.map((item) => {
    if (item.kind === "section") {
      return [
        {
          content: "",
          colSpan: 4,
          styles: {
            fillColor: [...SECTION_BG],
            textColor: [...INK],
            minCellHeight: 6.8,
          },
        },
      ];
    }
    const { row, index } = item;
    return [
      row.sph,
      formatLensOrderCyl(row.cyl),
      String(row.quantityToOrder),
      String(index),
    ];
  });
}

export function buildLensOrderPdf(
  rows: LensOrderRow[],
  options: LensOrderPdfOptions,
): { bytes: Uint8Array; pageCount: number; filename: string } {
  const generatedAt = options.generatedAt ?? new Date();
  const phone = options.phone?.trim() || "";
  const totals = lensOrderTotals(rows);
  const display = buildLensOrderDisplayItems(rows);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  registerFont(doc, "NotoSans-Regular.ttf", FONT_LATIN, options.fonts.latin, [
    "normal",
    "bold",
  ]);
  registerFont(
    doc,
    "NotoSansHebrew-Regular.ttf",
    FONT_HEBREW,
    options.fonts.hebrew,
    ["normal", "bold"],
  );
  registerFont(
    doc,
    "NotoNaskhArabic-Regular.ttf",
    FONT_ARABIC,
    options.fonts.arabic,
  );
  doc.setFont(FONT_LATIN, "normal");

  const tableW = PAGE_W - (INNER + 2) * 2;
  autoTable(doc, {
    startY: TABLE_TOP,
    margin: { top: TABLE_TOP, left: INNER + 2, right: INNER + 2, bottom: 24 },
    theme: "grid",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    tableWidth: tableW,
    head: [
      [
        {
          content: "SPH",
          styles: { font: FONT_LATIN, fontStyle: "bold" },
        },
        {
          content: "CYL",
          styles: { font: FONT_LATIN, fontStyle: "bold" },
        },
        {
          content: pdfRtlText("כמות להזמנה"),
          styles: { font: FONT_HEBREW, fontStyle: "bold" },
        },
        "#",
      ],
    ],
    body: tableBody(rows),
    styles: {
      font: FONT_LATIN,
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 },
      textColor: [...INK],
      lineColor: [...GRID],
      lineWidth: 0.16,
      overflow: "linebreak",
      minCellHeight: 6.2,
    },
    headStyles: {
      fillColor: [...HEAD_BG],
      textColor: [...GOLD],
      fontStyle: "bold",
      font: FONT_LATIN,
      fontSize: 8.4,
      lineColor: [255, 255, 255],
      lineWidth: 0.18,
    },
    alternateRowStyles: { fillColor: [...ALT_ROW] },
    columnStyles: {
      0: { cellWidth: tableW * 0.32 },
      1: { cellWidth: tableW * 0.32 },
      2: { cellWidth: tableW * 0.26, fontStyle: "bold" },
      3: { cellWidth: tableW * 0.1 },
    },
    didDrawPage: () => {
      drawPageChrome(doc, generatedAt, totals, phone);
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index !== 0) return;
      const item = display[data.row.index];
      if (item?.kind !== "section") return;
      const mark = item.id === "negative" ? "–" : "+";
      const { x, y, height } = data.cell;
      const cx = x + 5.2;
      const cy = y + height / 2;
      doc.setFillColor(...INK);
      doc.circle(cx, cy, 2.05, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont(FONT_LATIN, "bold");
      doc.setFontSize(8);
      doc.text(mark, cx, cy + 0.75, { align: "center" });
      doc.setTextColor(...INK);
    },
  });

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return {
    bytes,
    pageCount: doc.getNumberOfPages(),
    filename: LENS_ORDER_PDF_FILENAME,
  };
}

export function buildLensOrderPdfBytes(
  rows: LensOrderRow[],
  options: LensOrderPdfOptions,
): Uint8Array {
  return buildLensOrderPdf(rows, options).bytes;
}

export { lensOrderPdfFilename };

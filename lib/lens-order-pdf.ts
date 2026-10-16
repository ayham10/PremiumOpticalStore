import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  LENS_ORDER_LOCATION_HE,
  LENS_ORDER_PDF_FILENAME,
  LENS_ORDER_WEBSITE,
  buildLensOrderDisplayItems,
  formatLensOrderCyl,
  formatLensOrderDate,
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
const MARGIN = 10;
const TABLE_TOP = 42;
const INK = [17, 17, 17] as const;
const GRID = [102, 102, 102] as const;
const HEAD_BG = [26, 26, 26] as const;
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

function pdfSectionMark(id: "negative" | "positive"): string {
  // Noto Sans lacks U+2212; en-dash is the closest embedded minus.
  return id === "negative" ? "–" : "+";
}

function drawRtlMixed(
  doc: jsPDF,
  logical: string,
  xRight: number,
  y: number,
  size: number,
  hebrewStyle: "normal" | "bold" = "normal",
) {
  const tokens = logical.match(/[\u0590-\u05FF״׳]+|\d+(?:[.,]\d+)?|[A-Za-z]+|\s+|[^\s]/g) || [];
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

function drawOyonLogo(doc: jsPDF, cx: number, top: number) {
  doc.setTextColor(...INK);
  doc.setFont(FONT_LATIN, "bold");
  doc.setFontSize(10.4);
  doc.text("OYON", cx, top + 4.2, { align: "center", charSpace: 1.15 });
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.22);
  doc.line(cx - 10, top + 5.6, cx - 3.6, top + 5.6);
  doc.line(cx + 3.6, top + 5.6, cx + 10, top + 5.6);
  doc.setFont(FONT_ARABIC, "normal");
  doc.setFontSize(7.2);
  doc.text(pdfRtlText("عيون"), cx, top + 9.4, { align: "center" });
}

function drawPageChrome(
  doc: jsPDF,
  generatedAt: Date,
  totals: { requiredQuantity: number; quantity: number },
  phone: string,
) {
  drawOyonLogo(doc, PAGE_W / 2, 8);

  drawRtlMixed(doc, "רשימת הזמנה לעדשות", PAGE_W - MARGIN, 24, 13, "bold");
  drawRtlMixed(doc, formatLensOrderDate(generatedAt), PAGE_W - MARGIN, 30, 9);
  drawRtlMixed(
    doc,
    `סה״כ כמות נדרשת: ${totals.requiredQuantity}   סה״כ כמות להזמנה: ${totals.quantity}`,
    PAGE_W - MARGIN,
    35.5,
    9,
  );

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, 38.5, PAGE_W - MARGIN, 38.5);

  const footerY = phone ? 285.5 : 287.5;
  doc.setFont(FONT_HEBREW, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const location = pdfRtlText(LENS_ORDER_LOCATION_HE);
  const locationWidth = doc.getTextWidth(location);
  doc.setFont(FONT_LATIN, "normal");
  const separator = "  ·  ";
  const separatorWidth = doc.getTextWidth(separator);
  const websiteWidth = doc.getTextWidth(LENS_ORDER_WEBSITE);
  const footerWidth = locationWidth + separatorWidth + websiteWidth;
  const footerX = (PAGE_W - footerWidth) / 2;
  doc.setFont(FONT_HEBREW, "normal");
  doc.text(location, footerX, footerY);
  doc.setFont(FONT_LATIN, "normal");
  doc.text(separator, footerX + locationWidth, footerY);
  doc.text(LENS_ORDER_WEBSITE, footerX + locationWidth + separatorWidth, footerY);
  if (phone) {
    doc.text(phone, PAGE_W / 2, 291.2, { align: "center" });
  }
}

function tableBody(rows: LensOrderRow[]): RowInput[] {
  const items = buildLensOrderDisplayItems(rows);
  if (!items.length) {
    return [
      [
        {
          content: pdfRtlText("אין פריטים להזמנה"),
          colSpan: 6,
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
          content: pdfSectionMark(item.id),
          colSpan: 6,
          styles: {
            fillColor: [...SECTION_BG],
            textColor: [...INK],
            fontStyle: "bold",
            halign: "center",
            font: FONT_LATIN,
            fontSize: 11,
          },
        },
      ];
    }
    const { row, index } = item;
    return [
      String(index),
      row.sph,
      formatLensOrderCyl(row.cyl),
      String(row.desiredStock),
      String(row.currentStock),
      String(row.quantityToOrder),
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

  autoTable(doc, {
    startY: TABLE_TOP,
    margin: { top: TABLE_TOP, left: MARGIN, right: MARGIN, bottom: 18 },
    theme: "grid",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    tableWidth: PAGE_W - MARGIN * 2,
    head: [
      [
        "#",
        "SPH",
        "CYL",
        {
          content: pdfRtlText("כמות נדרשת"),
          styles: { font: FONT_HEBREW, fontStyle: "bold" },
        },
        {
          content: pdfRtlText("מלאי נוכחי"),
          styles: { font: FONT_HEBREW, fontStyle: "bold" },
        },
        {
          content: pdfRtlText("כמות להזמנה"),
          styles: { font: FONT_HEBREW, fontStyle: "bold" },
        },
      ],
    ],
    body: tableBody(rows),
    styles: {
      font: FONT_LATIN,
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      textColor: [...INK],
      lineColor: [...GRID],
      lineWidth: 0.18,
      overflow: "linebreak",
      minCellHeight: 6.4,
    },
    headStyles: {
      fillColor: [...HEAD_BG],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      font: FONT_LATIN,
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [...ALT_ROW] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
      5: { cellWidth: 40, fontStyle: "bold" },
    },
    didDrawPage: () => {
      drawPageChrome(doc, generatedAt, totals, phone);
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

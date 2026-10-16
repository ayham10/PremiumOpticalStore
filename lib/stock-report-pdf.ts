import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfRtlText } from "@/lib/rtl-pdf-text";
import {
  STOCK_EXPORT_BRAND_AR,
  STOCK_EXPORT_BRAND_EN,
  STOCK_EXPORT_LOCATION_AR,
  STOCK_EXPORT_LOCATION_EN,
  STOCK_EXPORT_WEBSITE,
  stockExportDateLabel,
  stockStatusFill,
  summarizeStockExportRows,
  type StockExportLabels,
  type StockExportRow,
} from "@/lib/stock-export";
import type { Locale } from "@/lib/i18n/config";

export type StockReportPdfFonts = {
  latin: Uint8Array;
  latinBold: Uint8Array;
  hebrew: Uint8Array;
  hebrewBold: Uint8Array;
  arabic: Uint8Array;
};

export type StockReportPdfOptions = {
  rows: StockExportRow[];
  labels: StockExportLabels;
  locale: Locale;
  fonts: StockReportPdfFonts;
  logo?: Uint8Array;
  generatedAt?: Date;
  imageBytesByUrl?: Record<string, Uint8Array>;
};

const FONT_LATIN = "NotoSans";
const FONT_HEBREW = "NotoSansHebrew";
const FONT_ARABIC = "NotoNaskhArabic";
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const INK: [number, number, number] = [20, 24, 30];
const GRID: [number, number, number] = [210, 210, 210];
const HEAD_BG: [number, number, number] = [15, 18, 24];
const ALT: [number, number, number] = [246, 247, 249];
const GOLD: [number, number, number] = [212, 175, 55];

function binaryStringFromBytes(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return parts.join("");
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  if (typeof Buffer !== "undefined") {
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return `data:${mime};base64,${btoa(binaryStringFromBytes(bytes))}`;
}

function registerFont(
  doc: jsPDF,
  filename: string,
  family: string,
  bytes: Uint8Array,
  style: "normal" | "bold" = "normal",
) {
  doc.addFileToVFS(filename, binaryStringFromBytes(bytes));
  doc.addFont(filename, family, style);
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function setTextFont(doc: jsPDF, text: string, bold = false) {
  if (hasArabic(text)) {
    doc.setFont(FONT_ARABIC, "normal");
    return;
  }
  if (hasHebrew(text)) {
    doc.setFont(FONT_HEBREW, bold ? "bold" : "normal");
    return;
  }
  doc.setFont(FONT_LATIN, bold ? "bold" : "normal");
}

const WHITE: [number, number, number] = [255, 255, 255];

function drawVisualText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: {
    align?: "left" | "center" | "right";
    size?: number;
    bold?: boolean;
    color?: readonly [number, number, number];
  } = {},
) {
  const size = opts.size ?? 9;
  const bold = opts.bold ?? false;
  const color = opts.color ?? INK;
  doc.setFontSize(size);
  doc.setTextColor(...color);
  setTextFont(doc, text, bold);
  const visual =
    hasArabic(text) || hasHebrew(text) ? pdfRtlText(text) : text;
  doc.text(visual, x, y, { align: opts.align ?? "left" });
}

function drawTableHeadLabel(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
) {
  doc.setFontSize(7.2);
  doc.setTextColor(...WHITE);
  setTextFont(doc, text, true);
  const visual =
    hasArabic(text) || hasHebrew(text) ? pdfRtlText(text) : text;
  doc.text(visual, x + width / 2, y, { align: "center" });
}

function pngMime(bytes: Uint8Array): "PNG" | "JPEG" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "PNG";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "JPEG";
  return null;
}

function formatPriceCell(value: number): string {
  return `₪${value.toLocaleString("en-US")}`;
}

export function buildStockReportPdf(options: StockReportPdfOptions): {
  bytes: Uint8Array;
  pageCount: number;
  filename: string;
} {
  const generatedAt = options.generatedAt ?? new Date();
  const summary = summarizeStockExportRows(options.rows);
  const labels = options.labels;
  const rtl = options.locale === "ar" || options.locale === "he";

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  registerFont(doc, "NotoSans-Regular.ttf", FONT_LATIN, options.fonts.latin);
  registerFont(
    doc,
    "NotoSans-Bold.ttf",
    FONT_LATIN,
    options.fonts.latinBold,
    "bold",
  );
  registerFont(
    doc,
    "NotoSansHebrew-Regular.ttf",
    FONT_HEBREW,
    options.fonts.hebrew,
  );
  registerFont(
    doc,
    "NotoSansHebrew-Bold.ttf",
    FONT_HEBREW,
    options.fonts.hebrewBold,
    "bold",
  );
  registerFont(
    doc,
    "NotoNaskhArabic-Regular.ttf",
    FONT_ARABIC,
    options.fonts.arabic,
  );
  doc.setFont(FONT_LATIN, "normal");

  const drawHeader = () => {
    if (options.logo && options.logo.byteLength > 24) {
      try {
        doc.addImage(
          bytesToDataUrl(options.logo, "image/png"),
          "PNG",
          MARGIN,
          7,
          34,
          14,
          undefined,
          "FAST",
        );
      } catch {
        // omit broken logo
      }
    }

    drawVisualText(doc, labels.titleAr || STOCK_EXPORT_BRAND_AR, PAGE_W / 2, 12, {
      align: "center",
      size: 14,
      bold: true,
    });
    drawVisualText(doc, labels.titleEn || STOCK_EXPORT_BRAND_EN, PAGE_W / 2, 18, {
      align: "center",
      size: 10,
      bold: true,
    });
    const dateValue = stockExportDateLabel(generatedAt, options.locale);
    drawVisualText(doc, `${labels.reportDate}:`, PAGE_W - MARGIN, 11, {
      align: "right",
      size: 8.2,
      bold: true,
    });
    doc.setFont(FONT_LATIN, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(dateValue, PAGE_W - MARGIN, 15.2, { align: "right" });

    const cards = [
      { label: labels.totalQty, value: String(summary.totalQty) },
      { label: labels.inStock, value: String(summary.inStock) },
      { label: labels.lowStock, value: String(summary.lowStock) },
      { label: labels.outOfStock, value: String(summary.outOfStock) },
    ];
    const cardW = (PAGE_W - MARGIN * 2 - 9) / 4;
    cards.forEach((card, index) => {
      const x = MARGIN + index * (cardW + 3);
      const y = 24;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.35);
      doc.setFillColor(250, 250, 252);
      doc.roundedRect(x, y, cardW, 14, 1.2, 1.2, "FD");
      drawVisualText(doc, card.label, x + cardW / 2, y + 5.2, {
        align: "center",
        size: 7.4,
        bold: true,
      });
      drawVisualText(doc, card.value, x + cardW / 2, y + 11, {
        align: "center",
        size: 11,
        bold: true,
      });
    });
  };

  const drawFooter = () => {
    const y = PAGE_H - 7;
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
    drawVisualText(
      doc,
      `${STOCK_EXPORT_WEBSITE}  ·  ${labels.location || `${STOCK_EXPORT_LOCATION_AR} / ${STOCK_EXPORT_LOCATION_EN}`}`,
      PAGE_W / 2,
      y,
      { align: "center", size: 8, bold: true },
    );
  };

  const headers = [
    labels.colImage,
    labels.colName,
    labels.colNumber,
    labels.colCategory,
    labels.colColor,
    labels.colSize,
    labels.colPrice,
    labels.colStock,
    labels.colMin,
    labels.colRequired,
    labels.colStatus,
  ];
  const orderedHeaders = rtl ? [...headers].reverse() : headers;

  const body = options.rows.map((row) => {
    const cells = [
      "",
      row.name,
      row.productNumber,
      row.category,
      row.color,
      row.frameSize,
      formatPriceCell(row.price),
      String(row.stockQuantity),
      String(row.minimumStock),
      String(row.requiredQuantity),
      row.statusLabel,
    ];
    return rtl ? cells.reverse() : cells;
  });

  const tableW = PAGE_W - MARGIN * 2;
  const widths = [
    tableW * 0.08,
    tableW * 0.18,
    tableW * 0.09,
    tableW * 0.1,
    tableW * 0.08,
    tableW * 0.07,
    tableW * 0.08,
    tableW * 0.06,
    tableW * 0.07,
    tableW * 0.08,
    tableW * 0.11,
  ];
  const orderedWidths = rtl ? [...widths].reverse() : widths;

  autoTable(doc, {
    startY: 42,
    margin: { top: 42, left: MARGIN, right: MARGIN, bottom: 14 },
    theme: "grid",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    head: [orderedHeaders],
    body: body.length
      ? body
      : [
          [
            {
              content: labels.empty,
              colSpan: orderedHeaders.length,
              styles: { halign: "center" },
            },
          ],
        ],
    styles: {
      font: FONT_LATIN,
      fontSize: 7.4,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.4, right: 1.4 },
      valign: "middle",
      halign: "center",
      textColor: INK,
      lineColor: GRID,
      lineWidth: 0.12,
      minCellHeight: 11,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      minCellHeight: 9,
    },
    alternateRowStyles: { fillColor: ALT },
    columnStyles: Object.fromEntries(
      orderedWidths.map((width, index) => [index, { cellWidth: width }]),
    ),
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
    willDrawCell: (data) => {
      if (data.section === "head") {
        data.cell.text = [];
      }
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.text = [];
        return;
      }
      if (data.section !== "body") return;
      const statusCol = rtl ? 0 : orderedHeaders.length - 1;
      if (data.column.index !== statusCol) return;
      const row = options.rows[data.row.index];
      if (!row) return;
      const tone = stockStatusFill(row.level);
      data.cell.styles.fillColor = tone.fill;
      data.cell.styles.textColor = tone.text;
      data.cell.styles.fontStyle = "bold";
    },
    didDrawCell: (data) => {
      if (data.section === "head") {
        const label = orderedHeaders[data.column.index] || "";
        if (!label) return;
        const { x, y, width, height } = data.cell;
        doc.setFillColor(...HEAD_BG);
        doc.rect(x, y, width, height, "F");
        drawTableHeadLabel(doc, label, x, y + height / 2 + 1.05, width);
        return;
      }
      if (data.section !== "body") return;
      const imageCol = rtl ? orderedHeaders.length - 1 : 0;
      if (data.column.index === imageCol) {
        const row = options.rows[data.row.index];
        const bytes = row ? options.imageBytesByUrl?.[row.imageUrl] : undefined;
        if (!bytes) return;
        const kind = pngMime(bytes);
        if (!kind) return;
        const pad = 1.2;
        const size = Math.min(data.cell.width, data.cell.height) - pad * 2;
        try {
          doc.addImage(
            bytesToDataUrl(
              bytes,
              kind === "PNG" ? "image/png" : "image/jpeg",
            ),
            kind,
            data.cell.x + (data.cell.width - size) / 2,
            data.cell.y + (data.cell.height - size) / 2,
            size,
            size,
            undefined,
            "FAST",
          );
        } catch {
          // skip broken image
        }
        return;
      }
      const raw = String(data.cell.raw ?? data.cell.text?.[0] ?? "");
      if (!raw || (!hasArabic(raw) && !hasHebrew(raw))) return;
      const { x, y, width, height } = data.cell;
      doc.setFillColor(
        data.row.index % 2 === 1 ? ALT[0] : 255,
        data.row.index % 2 === 1 ? ALT[1] : 255,
        data.row.index % 2 === 1 ? ALT[2] : 255,
      );
      const statusCol = rtl ? 0 : orderedHeaders.length - 1;
      if (data.column.index === statusCol) {
        const row = options.rows[data.row.index];
        if (row) {
          const tone = stockStatusFill(row.level);
          doc.setFillColor(...tone.fill);
        }
      }
      doc.rect(x, y, width, height, "F");
      drawVisualText(doc, raw, x + width / 2, y + height / 2 + 1, {
        align: "center",
        size: 7.2,
        bold: data.column.index === statusCol,
      });
    },
  });

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return {
    bytes,
    pageCount: doc.getNumberOfPages(),
    filename: labels.pdfFilename,
  };
}

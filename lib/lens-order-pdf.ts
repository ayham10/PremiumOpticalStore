import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  LENS_ORDER_BRAND_HE,
  LENS_ORDER_COL_CYL,
  LENS_ORDER_COL_INDEX,
  LENS_ORDER_COL_QTY,
  LENS_ORDER_COL_SPH,
  LENS_ORDER_LOCATION_EN,
  LENS_ORDER_LOCATION_HE,
  LENS_ORDER_PDF_FILENAME,
  LENS_ORDER_TITLE,
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
  latinBold: Uint8Array;
  hebrew: Uint8Array;
  hebrewBold: Uint8Array;
  arabic: Uint8Array;
};

export type LensOrderPdfOptions = {
  generatedAt?: Date;
  fonts: LensOrderPdfFonts;
  logo?: Uint8Array;
  phone?: string | null;
};

const FONT_LATIN = "NotoSans";
const FONT_HEBREW = "NotoSansHebrew";
const FONT_ARABIC = "NotoNaskhArabic";
const PAGE_W = 210;
const PAGE_H = 297;
const OUTER = 7;
const INNER = 8.6;
const TABLE_TOP = 58.8;
const FOOTER_GAP = 4.8;
const FOOTER_RULE_Y_FULL = 277.4;
const FOOTER_TEXT_OFFSET = 8.2;
const FOOTER_TAIL = 12.8;
const FOOTER_ICON_SCALE = 1.18;
const INK = [0, 0, 0] as const;
const WHITE = [255, 255, 255] as const;
const GRID = [196, 196, 196] as const;
const HEAD_BG = [0, 0, 0] as const;
const ALT_ROW = [245, 245, 245] as const;
const SECTION_BG = [232, 232, 232] as const;
const HEADERS = [
  LENS_ORDER_COL_INDEX,
  LENS_ORDER_COL_SPH,
  LENS_ORDER_COL_CYL,
  LENS_ORDER_COL_QTY,
] as const;

const MIXED_TOKEN =
  /[\u0590-\u05FF״׳]+|\d{1,2}\.\d{1,2}\.\d{4}|\d{2,3}-\d{3,7}(?:-\d{3,4})?|\d+(?:[.,]\d+)?|[A-Za-z#]+(?:\.[A-Za-z]+)*|\s+|[^\s]/g;

function binaryStringFromBytes(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return parts.join("");
}

function bytesToPngDataUrl(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return `data:image/png;base64,${btoa(binaryStringFromBytes(bytes))}`;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) return { width: 1, height: 1 };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
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

function isHebrewToken(token: string): boolean {
  return /[\u0590-\u05FF]/.test(token);
}

function tokenWidth(
  doc: jsPDF,
  token: string,
  size: number,
  hebrewStyle: "normal" | "bold",
): { visual: string; hebrew: boolean; width: number } {
  const hebrew = isHebrewToken(token);
  const visual = hebrew ? [...token].reverse().join("") : token;
  doc.setFontSize(size);
  doc.setFont(hebrew ? FONT_HEBREW : FONT_LATIN, hebrewStyle);
  return { visual, hebrew, width: doc.getTextWidth(visual) };
}

function drawRtlMixed(
  doc: jsPDF,
  logical: string,
  xRight: number,
  y: number,
  size: number,
  hebrewStyle: "normal" | "bold" = "normal",
) {
  const tokens = logical.match(MIXED_TOKEN) || [];
  let x = xRight;
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  for (const token of tokens) {
    const { visual, hebrew, width } = tokenWidth(doc, token, size, hebrewStyle);
    x -= width;
    if (hebrew) doc.setFont(FONT_HEBREW, hebrewStyle);
    else doc.setFont(FONT_LATIN, hebrewStyle === "bold" ? "bold" : "normal");
    doc.text(visual, x, y);
  }
}

function drawCenteredMixed(
  doc: jsPDF,
  logical: string,
  cx: number,
  y: number,
  size: number,
  color: readonly [number, number, number],
  hebrewStyle: "normal" | "bold" = "bold",
) {
  doc.setTextColor(...color);
  doc.setFontSize(size);
  if (/[\u0590-\u05FF]/.test(logical) && !/[A-Za-z#]/.test(logical)) {
    doc.setFont(FONT_HEBREW, hebrewStyle);
    const visual = pdfRtlText(logical);
    const width = doc.getTextWidth(visual);
    doc.text(visual, cx - width / 2, y);
    return;
  }
  const tokens = logical.match(MIXED_TOKEN) || [];
  const measured = tokens.map((token) => tokenWidth(doc, token, size, hebrewStyle));
  const total = measured.reduce((sum, part) => sum + part.width, 0);
  let x = cx - total / 2;
  for (const part of measured) {
    doc.setFont(part.hebrew ? FONT_HEBREW : FONT_LATIN, hebrewStyle);
    doc.text(part.visual, x, y);
    x += part.width;
  }
}

function drawPhoneIcon(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...INK);
  doc.setDrawColor(...INK);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.setLineWidth(0.95);
  doc.line(x + 0.35, y - 1.85, x + 2.55, y + 1.15);
  doc.circle(x + 0.25, y - 2.05, 1.05, "F");
  doc.circle(x + 2.65, y + 1.35, 1.05, "F");
}

function drawPhoneLine(doc: jsPDF, phone: string, y: number) {
  const iconX = INNER + 3.2;
  drawPhoneIcon(doc, iconX, y - 0.2);
  let x = iconX + 4.8;
  doc.setFontSize(10.4);
  doc.setTextColor(...INK);
  doc.setFont(FONT_HEBREW, "bold");
  const label = pdfRtlText("טלפון");
  doc.text(label, x, y);
  x += doc.getTextWidth(label);
  doc.setFont(FONT_LATIN, "bold");
  doc.text(`: ${phone}`, x, y);
}

function drawPin(doc: jsPDF, x: number, y: number, scale = FOOTER_ICON_SCALE) {
  doc.setFillColor(...INK);
  doc.circle(x, y - 1.15 * scale, 2.15 * scale, "F");
  doc.triangle(
    x - 1.7 * scale,
    y - 0.45 * scale,
    x + 1.7 * scale,
    y - 0.45 * scale,
    x,
    y + 3.35 * scale,
    "F",
  );
  doc.setFillColor(...WHITE);
  doc.circle(x, y - 1.25 * scale, 0.82 * scale, "F");
}

function drawGlobe(doc: jsPDF, x: number, y: number, scale = FOOTER_ICON_SCALE) {
  const r = 2.5 * scale;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.38);
  doc.circle(x, y, r, "S");
  doc.ellipse(x, y, 1.1 * scale, r, "S");
  doc.line(x - r, y, x + r, y);
  doc.line(x - 2.1 * scale, y - 1.2 * scale, x + 2.1 * scale, y - 1.2 * scale);
  doc.line(x - 2.1 * scale, y + 1.2 * scale, x + 2.1 * scale, y + 1.2 * scale);
}

function containSize(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const aspect = srcH > 0 ? srcW / srcH : 2.5;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

function drawLogo(doc: jsPDF, logo?: Uint8Array) {
  const x = INNER + 2.2;
  const y = INNER + 1.8;
  const maxW = 64;
  const maxH = 28;
  if (logo && logo.byteLength > 24) {
    const { width, height } = pngDimensions(logo);
    const { w, h } = containSize(width, height, maxW, maxH);
    try {
      doc.addImage(bytesToPngDataUrl(logo), "PNG", x, y, w, h, undefined, "NONE");
      return;
    } catch {
      // Fall through to a simple mark if the PNG cannot be embedded.
    }
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.45);
  doc.ellipse(x + 10, y + 7.2, 8.2, 4.1, "S");
  doc.setFillColor(...INK);
  doc.circle(x + 10, y + 7.2, 2.2, "F");
}

function drawPageHeader(
  doc: jsPDF,
  generatedAt: Date,
  totals: { requiredQuantity: number; quantity: number },
  phone: string,
  logo?: Uint8Array,
) {
  drawLogo(doc, logo);

  const right = PAGE_W - INNER - 3.2;
  const titleSize = 16.8;
  drawRtlMixed(doc, LENS_ORDER_TITLE, right, 17.6, titleSize, "bold");
  const titleTokens = LENS_ORDER_TITLE.match(MIXED_TOKEN) || [];
  const titleW = titleTokens.reduce(
    (sum, token) => sum + tokenWidth(doc, token, titleSize, "bold").width,
    0,
  );
  doc.setFillColor(...INK);
  doc.rect(right - Math.min(titleW, 46), 19.6, Math.min(titleW, 46), 0.55, "F");
  drawRtlMixed(
    doc,
    `תאריך הזמנה: ${formatLensOrderNumericDate(generatedAt)}`,
    right,
    26.6,
    11,
    "bold",
  );
  drawRtlMixed(
    doc,
    `שם העסק: ${LENS_ORDER_BRAND_HE}`,
    right,
    33.2,
    11.2,
    "bold",
  );

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.38);
  doc.line(INNER + 1.6, 38.6, PAGE_W - INNER - 1.6, 38.6);

  drawRtlMixed(
    doc,
    `סה״כ כמות נדרשת: ${totals.requiredQuantity} | סה״כ כמות להזמנה: ${totals.quantity}`,
    right,
    45.4,
    10.8,
    "bold",
  );
  if (phone) {
    drawPhoneLine(doc, phone, 45.4);
  }

  doc.setDrawColor(...INK);
  doc.line(INNER + 1.6, 50.2, PAGE_W - INNER - 1.6, 50.2);
}

function drawPageFrame(doc: jsPDF, bottomY: number) {
  const outerH = bottomY - OUTER * 2;
  const innerH = bottomY - INNER * 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.38);
  doc.rect(OUTER, OUTER, PAGE_W - OUTER * 2, outerH, "S");
  doc.setLineWidth(0.7);
  doc.rect(INNER, INNER, PAGE_W - INNER * 2, innerH, "S");
}

function drawPageFooter(doc: jsPDF, ruleY: number) {
  const footY = ruleY + FOOTER_TEXT_OFFSET;
  const midX = PAGE_W / 2;
  const leftEdge = INNER + 3.2;
  const rightEdge = PAGE_W - INNER - 3.2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.32);
  doc.line(INNER + 1.6, ruleY, PAGE_W - INNER - 1.6, ruleY);
  doc.line(midX, ruleY + 2.1, midX, ruleY + 15.4);

  const globeX = leftEdge + 3.4;
  const globeY = footY + 0.85;
  drawGlobe(doc, globeX, globeY);
  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...INK);
  const webX = leftEdge + 10.2;
  doc.text(LENS_ORDER_WEBSITE, webX, footY + 1.45);

  const pinX = rightEdge - 3.1;
  drawPin(doc, pinX, footY + 0.2);
  const locTextRight = pinX - 3.6;
  doc.setFont(FONT_HEBREW, "bold");
  doc.setFontSize(9.6);
  doc.text(pdfRtlText(LENS_ORDER_LOCATION_HE), locTextRight, footY - 0.35, {
    align: "right",
  });
  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(8.6);
  doc.text(LENS_ORDER_LOCATION_EN, locTextRight, footY + 3.55, { align: "right" });
}

function footerRuleYForPage(
  pageNumber: number,
  pageCount: number,
  tableEndY: number,
): number {
  if (pageNumber < pageCount) return FOOTER_RULE_Y_FULL;
  const dynamic = tableEndY + FOOTER_GAP;
  const maxRule = PAGE_H - INNER - FOOTER_TAIL;
  return Math.min(Math.max(dynamic, TABLE_TOP + 12), maxRule);
}

function frameBottomY(ruleY: number): number {
  return ruleY + FOOTER_TEXT_OFFSET + FOOTER_TAIL;
}

function setPageHeightMm(doc: jsPDF, pageNumber: number, heightMm: number) {
  const minHeight = frameBottomY(TABLE_TOP + 12);
  const height = Math.max(heightMm, minHeight);
  const withApi = doc as jsPDF & {
    setPageHeight?: (page: number, value: number) => void;
  };
  if (withApi.setPageHeight) {
    withApi.setPageHeight(pageNumber, height);
    return;
  }
  const internal = doc.internal as typeof doc.internal & {
    pagesContext?: Record<
      number,
      { mediaBox: { bottomLeftY: number; topRightY: number } }
    >;
  };
  const scale = internal.scaleFactor;
  const page = internal.pagesContext?.[pageNumber];
  if (!page?.mediaBox) return;
  page.mediaBox.topRightY = page.mediaBox.bottomLeftY + height * scale;
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
            minCellHeight: 6.6,
          },
        },
      ];
    }
    const { row, index } = item;
    return [
      String(index),
      row.sph,
      formatLensOrderCyl(row.cyl),
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
  const display = buildLensOrderDisplayItems(rows);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  registerFont(doc, "NotoSans-Regular.ttf", FONT_LATIN, options.fonts.latin, "normal");
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
    "normal",
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
    "normal",
  );
  doc.setFont(FONT_LATIN, "normal");

  const tableW = PAGE_W - (INNER + 2.2) * 2;
  autoTable(doc, {
    startY: TABLE_TOP,
    margin: {
      top: TABLE_TOP,
      left: INNER + 2.2,
      right: INNER + 2.2,
      bottom: PAGE_H - FOOTER_RULE_Y_FULL + 6,
    },
    theme: "grid",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    tableWidth: tableW,
    head: [HEADERS.map(() => " ")],
    body: tableBody(rows),
    styles: {
      font: FONT_LATIN,
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 1.85, bottom: 1.85, left: 2, right: 2 },
      textColor: [...INK],
      lineColor: [...GRID],
      lineWidth: 0.16,
      overflow: "linebreak",
      minCellHeight: 6.6,
    },
    headStyles: {
      fillColor: [...HEAD_BG],
      textColor: [...HEAD_BG],
      fontStyle: "bold",
      font: FONT_LATIN,
      fontSize: 8.2,
      minCellHeight: 9.4,
      lineColor: [...WHITE],
      lineWidth: 0.18,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [...ALT_ROW] },
    columnStyles: {
      0: { cellWidth: tableW * 0.1 },
      1: { cellWidth: tableW * 0.29 },
      2: { cellWidth: tableW * 0.29 },
      3: { cellWidth: tableW * 0.32, fontStyle: "bold" },
    },
    didDrawPage: () => {
      drawPageHeader(doc, generatedAt, totals, phone, options.logo);
    },
    didDrawCell: (data) => {
      if (data.section === "head") {
        const label = HEADERS[data.column.index];
        if (!label) return;
        const { x, y, width, height } = data.cell;
        drawCenteredMixed(
          doc,
          label,
          x + width / 2,
          y + height / 2 + 1.15,
          8,
          WHITE,
          "bold",
        );
        return;
      }
      if (data.section !== "body") return;
      if (data.column.index !== 0) return;
      const item = display[data.row.index];
      if (item?.kind !== "section") return;
      const mark = item.id === "negative" ? "–" : "+";
      const { x, y, height } = data.cell;
      const cx = x + 6.2;
      const cy = y + height / 2;
      doc.setFillColor(...INK);
      doc.circle(cx, cy, 2.05, "F");
      doc.setTextColor(...WHITE);
      doc.setFont(FONT_LATIN, "bold");
      doc.setFontSize(8);
      doc.text(mark, cx, cy + 0.75, { align: "center" });
      doc.setTextColor(...INK);
    },
  });

  const tableEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    TABLE_TOP;
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const ruleY = footerRuleYForPage(page, pageCount, tableEndY);
    drawPageFooter(doc, ruleY);
    const bottomY = frameBottomY(ruleY);
    drawPageFrame(doc, bottomY);
    if (page === pageCount) {
      setPageHeightMm(doc, page, bottomY + OUTER);
    }
  }

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

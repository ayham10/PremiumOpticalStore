import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  buildLensOrderDisplayItems,
  formatLensOrderCyl,
  lensOrderPdfFilename,
  lensOrderSectionTitle,
  lensOrderTotals,
  type LensOrderRow,
} from "@/lib/lens-inventory";
import { pdfRtlText } from "@/lib/rtl-pdf-text";

export type LensOrderPdfFonts = {
  latin: Uint8Array;
  hebrew: Uint8Array;
  arabic: Uint8Array;
};

const FONT_LATIN = "NotoSans";
const FONT_HEBREW = "NotoSansHebrew";
const FONT_ARABIC = "NotoNaskhArabic";

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

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function drawPageHeader(
  doc: jsPDF,
  generatedAt: Date,
  totals: { requiredQuantity: number; quantity: number },
) {
  doc.setFillColor(11, 23, 34);
  doc.rect(12, 10, 186, 1.1, "F");
  doc.setDrawColor(212, 175, 106);
  doc.setLineWidth(0.5);
  doc.line(12, 12, 198, 12);

  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(13);
  doc.setTextColor(11, 23, 34);
  doc.text("OYON OPTICS", 12, 18);

  doc.setFont(FONT_HEBREW, "normal");
  doc.setFontSize(11);
  doc.text(pdfRtlText("עיון אופטיקה"), 198, 18, { align: "right" });

  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(12);
  doc.text("Lens Order List", 12, 24);
  doc.setFont(FONT_ARABIC, "normal");
  doc.setFontSize(11);
  doc.text(pdfRtlText("قائمة الطلبية"), 198, 24, { align: "right" });

  doc.setFont(FONT_LATIN, "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 96);
  doc.text(`Order date: ${isoDate(generatedAt)}`, 12, 30);
  doc.setTextColor(11, 23, 34);
  doc.text(
    `Total required quantity: ${totals.requiredQuantity}    Total order quantity: ${totals.quantity}`,
    12,
    35,
  );
}

function tableBody(rows: LensOrderRow[]): RowInput[] {
  const items = buildLensOrderDisplayItems(rows);
  if (!items.length) {
    return [
      [
        {
          content: "No items to order",
          colSpan: 6,
          styles: { halign: "center", fontStyle: "italic" },
        },
      ],
    ];
  }
  return items.map((item) => {
    if (item.kind === "section") {
      return [
        {
          content: lensOrderSectionTitle(item.id, "en"),
          colSpan: 6,
          styles: {
            fillColor: [238, 242, 246],
            textColor: [11, 23, 34],
            fontStyle: "bold",
            halign: "left",
            font: FONT_LATIN,
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
  options: {
    generatedAt?: Date;
    fonts: LensOrderPdfFonts;
  },
): { bytes: Uint8Array; pageCount: number; filename: string } {
  const generatedAt = options.generatedAt ?? new Date();
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
  );
  registerFont(
    doc,
    "NotoNaskhArabic-Regular.ttf",
    FONT_ARABIC,
    options.fonts.arabic,
  );
  doc.setFont(FONT_LATIN, "normal");

  autoTable(doc, {
    startY: 40,
    margin: { top: 40, left: 12, right: 12, bottom: 16 },
    theme: "grid",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    head: [
      [
        "#",
        "SPH",
        "CYL",
        "Required Quantity",
        "Current Stock",
        "Order Quantity",
      ],
    ],
    body: tableBody(rows),
    styles: {
      font: FONT_LATIN,
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      cellPadding: 1.6,
      textColor: [26, 31, 38],
      lineColor: [197, 204, 211],
      lineWidth: 0.15,
      overflow: "linebreak",
      minCellHeight: 6.2,
    },
    headStyles: {
      fillColor: [11, 23, 34],
      textColor: [244, 247, 250],
      fontStyle: "bold",
      font: FONT_LATIN,
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [244, 246, 248] },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 42 },
      4: { cellWidth: 38 },
      5: { cellWidth: 46, fontStyle: "bold", textColor: [184, 134, 43] },
    },
    didDrawPage: () => {
      drawPageHeader(doc, generatedAt, totals);
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont(FONT_LATIN, "normal");
    doc.setFontSize(8);
    doc.setTextColor(138, 146, 156);
    doc.text(`OYON OPTICS  ·  Page ${page} of ${pageCount}`, 105, 291, {
      align: "center",
    });
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return {
    bytes,
    pageCount,
    filename: lensOrderPdfFilename(generatedAt),
  };
}

export function buildLensOrderPdfBytes(
  rows: LensOrderRow[],
  options: {
    generatedAt?: Date;
    fonts: LensOrderPdfFonts;
  },
): Uint8Array {
  return buildLensOrderPdf(rows, options).bytes;
}

export { lensOrderPdfFilename };

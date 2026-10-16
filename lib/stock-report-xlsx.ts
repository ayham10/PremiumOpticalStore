import ExcelJS from "exceljs";
import {
  STOCK_EXPORT_WEBSITE,
  stockExportDateLabel,
  summarizeStockExportRows,
  type StockExportLabels,
  type StockExportRow,
} from "@/lib/stock-export";
import type { Locale } from "@/lib/i18n/config";
import type { StockLevel } from "@/lib/stock-status";

export type StockReportXlsxOptions = {
  rows: StockExportRow[];
  labels: StockExportLabels;
  locale: Locale;
  generatedAt?: Date;
  imageBytesByUrl?: Record<string, Uint8Array>;
};

function statusStyle(level: StockLevel): {
  fill: string;
  font: string;
} {
  if (level === "in") return { fill: "E8F6EF", font: "227854" };
  if (level === "low") return { fill: "FCF3DC", font: "966E14" };
  return { fill: "FAE8E8", font: "AA3C3C" };
}

function extensionForBytes(bytes: Uint8Array): "png" | "jpeg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  return null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function buildStockReportXlsx(
  options: StockReportXlsxOptions,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const generatedAt = options.generatedAt ?? new Date();
  const labels = options.labels;
  const summary = summarizeStockExportRows(options.rows);
  const rtl = options.locale === "ar" || options.locale === "he";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OYON OPTICS";
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(labels.sheetName || "Stock", {
    views: [{ state: "frozen", ySplit: 7, rightToLeft: rtl }],
  });

  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = labels.titleAr;
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF14181E" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("A2:K2");
  sheet.getCell("A2").value = labels.titleEn;
  sheet.getCell("A2").font = { bold: true, size: 11, color: { argb: "FF8A929C" } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.mergeCells("A3:K3");
  sheet.getCell("A3").value = `${labels.reportDate}: ${stockExportDateLabel(generatedAt, options.locale)} · ${STOCK_EXPORT_WEBSITE}`;
  sheet.getCell("A3").font = { size: 10, bold: true };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  const summaryCells: Array<[string, number]> = [
    [labels.totalQty, summary.totalQty],
    [labels.inStock, summary.inStock],
    [labels.lowStock, summary.lowStock],
    [labels.outOfStock, summary.outOfStock],
  ];
  summaryCells.forEach(([label, value], index) => {
    const col = 1 + index * 2;
    const labelCell = sheet.getCell(5, col);
    const valueCell = sheet.getCell(5, col + 1);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { bold: true, size: 10 };
    valueCell.font = { bold: true, size: 12, color: { argb: "FFD4AF37" } };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF7F4EA" },
    };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF7F4EA" },
    };
  });

  const headerRowIndex = 7;
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
  const headerRow = sheet.getRow(headerRowIndex);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F1218" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF2A2F36" } },
      left: { style: "thin", color: { argb: "FF2A2F36" } },
      bottom: { style: "thin", color: { argb: "FF2A2F36" } },
      right: { style: "thin", color: { argb: "FF2A2F36" } },
    };
  });
  headerRow.height = 22;

  sheet.columns = [
    { width: 12 },
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  options.rows.forEach((row, index) => {
    const excelRowIndex = headerRowIndex + 1 + index;
    const excelRow = sheet.getRow(excelRowIndex);
    excelRow.height = 48;
    const values = [
      "",
      row.name,
      row.productNumber,
      row.category,
      row.color,
      row.frameSize,
      row.price,
      row.stockQuantity,
      row.minimumStock,
      row.requiredQuantity,
      row.statusLabel,
    ];
    values.forEach((value, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = value;
      cell.alignment = {
        horizontal: colIndex === 1 ? (rtl ? "right" : "left") : "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD0D4DA" } },
        left: { style: "thin", color: { argb: "FFD0D4DA" } },
        bottom: { style: "thin", color: { argb: "FFD0D4DA" } },
        right: { style: "thin", color: { argb: "FFD0D4DA" } },
      };
      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF6F7F9" },
        };
      }
      if (colIndex === 6) {
        cell.numFmt = '"₪"#,##0';
      }
    });

    const statusCell = excelRow.getCell(11);
    const tone = statusStyle(row.level);
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${tone.fill}` },
    };
    statusCell.font = { bold: true, color: { argb: `FF${tone.font}` } };

    const imageBytes = options.imageBytesByUrl?.[row.imageUrl];
    const ext = imageBytes ? extensionForBytes(imageBytes) : null;
    if (imageBytes && ext) {
      try {
        const imageId = workbook.addImage({
          buffer: toArrayBuffer(imageBytes) as ExcelJS.Buffer,
          extension: ext,
        });
        sheet.addImage(imageId, {
          tl: { col: 0.15, row: excelRowIndex - 1 + 0.15 },
          ext: { width: 42, height: 42 },
          editAs: "oneCell",
        });
      } catch {
        // skip broken image
      }
    }
  });

  if (!options.rows.length) {
    const empty = sheet.getRow(headerRowIndex + 1);
    empty.getCell(1).value = labels.empty;
    sheet.mergeCells(headerRowIndex + 1, 1, headerRowIndex + 1, 11);
  }

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex + Math.max(options.rows.length, 1), column: 11 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer as ArrayBufferLike);
  return { bytes, filename: labels.xlsxFilename };
}

import { buildStockExportRows, buildStockExportRowsForPdf } from "@/lib/stock-export";
import {
  stockReportPdfCategoryHe,
  stockReportPdfLabels,
  stockReportPdfStatusHe,
} from "@/lib/stock-report-pdf-labels";
import type { StockExportLabels, StockExportRow } from "@/lib/stock-export";
import {
  buildStockReportPdf,
  type StockReportPdfFonts,
} from "@/lib/stock-report-pdf";
import { buildStockReportXlsx } from "@/lib/stock-report-xlsx";
import type { CategoryDefaultImages, Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import type { StockLevel } from "@/lib/stock-status";

async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadFonts(): Promise<StockReportPdfFonts> {
  const [latin, latinBold, hebrew, hebrewBold, arabic] = await Promise.all([
    fetchBytes("/fonts/NotoSans-Regular.ttf"),
    fetchBytes("/fonts/NotoSans-Bold.ttf"),
    fetchBytes("/fonts/NotoSansHebrew-Regular.ttf"),
    fetchBytes("/fonts/NotoSansHebrew-Bold.ttf"),
    fetchBytes("/fonts/NotoNaskhArabic-Regular.ttf"),
  ]);
  return { latin, latinBold, hebrew, hebrewBold, arabic };
}

async function loadLogo(): Promise<Uint8Array | undefined> {
  try {
    return await fetchBytes("/images/oyon-order-logo.png");
  } catch {
    return undefined;
  }
}

function blobFromBytes(bytes: Uint8Array, mime: string): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: mime });
}

function triggerDownload(bytes: Uint8Array, filename: string, mime: string) {
  const url = URL.createObjectURL(blobFromBytes(bytes, mime));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function loadImageBytes(
  rows: StockExportRow[],
  limit = 120,
): Promise<Record<string, Uint8Array>> {
  const unique = [...new Set(rows.map((row) => row.imageUrl).filter(Boolean))];
  const selected = unique.slice(0, limit);
  const entries = await Promise.all(
    selected.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength < 24 || bytes.byteLength > 2_500_000) return null;
        return [url, bytes] as const;
      } catch {
        return null;
      }
    }),
  );
  const map: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    if (entry) map[entry[0]] = entry[1];
  }
  return map;
}

export type StockReportDownloadOptions = {
  products: Product[];
  locale: Locale;
  labels: StockExportLabels;
  categoryLabel: (category: string) => string;
  statusLabel: (level: StockLevel) => string;
  defaults?: CategoryDefaultImages | null;
  generatedAt?: Date;
};

function buildRows(options: StockReportDownloadOptions): StockExportRow[] {
  return buildStockExportRows(options.products, {
    locale: options.locale,
    categoryLabel: options.categoryLabel,
    statusLabel: options.statusLabel,
    defaults: options.defaults,
  });
}

export async function downloadStockReportPdf(
  options: StockReportDownloadOptions,
): Promise<void> {
  const rows = buildStockExportRowsForPdf(options.products, {
    categoryLabel: stockReportPdfCategoryHe,
    statusLabel: stockReportPdfStatusHe,
    defaults: options.defaults,
  });
  const pdfLabels = stockReportPdfLabels(
    options.labels.pdfFilename,
    options.labels.xlsxFilename,
  );
  const [fonts, logo, imageBytesByUrl] = await Promise.all([
    loadFonts(),
    loadLogo(),
    loadImageBytes(rows),
  ]);
  const pdf = buildStockReportPdf({
    rows,
    labels: pdfLabels,
    locale: "he",
    fonts,
    logo,
    generatedAt: options.generatedAt,
    imageBytesByUrl,
  });
  triggerDownload(pdf.bytes, pdf.filename, "application/pdf");
}

export async function downloadStockReportXlsx(
  options: StockReportDownloadOptions,
): Promise<void> {
  const rows = buildRows(options);
  const imageBytesByUrl = await loadImageBytes(rows);
  const xlsx = await buildStockReportXlsx({
    rows,
    labels: options.labels,
    locale: options.locale,
    generatedAt: options.generatedAt,
    imageBytesByUrl,
  });
  triggerDownload(
    xlsx.bytes,
    xlsx.filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildStockExportRows,
  stockRequiredQuantity,
  summarizeStockExportRows,
  type StockExportLabels,
} from "../lib/stock-export";
import { buildStockReportPdf } from "../lib/stock-report-pdf";
import { buildStockReportXlsx } from "../lib/stock-report-xlsx";
import type { Product } from "../lib/types";

function product(partial: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    slug: partial.slug || partial.id,
    category: partial.category || "Frames",
    brand: partial.brand || "OYON",
    sku: partial.sku ?? "SKU-1",
    description: partial.description || "",
    images: partial.images || [],
    purchasePrice: partial.purchasePrice ?? 10,
    sellingPrice: partial.sellingPrice ?? 100,
    stockQuantity: partial.stockQuantity ?? 0,
    minimumStock: partial.minimumStock ?? 5,
    status: partial.status || "active",
    createdAt: partial.createdAt || "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt || "2026-01-01T00:00:00.000Z",
    color: partial.color,
    frameSize: partial.frameSize,
    ...partial,
  };
}

assert.equal(stockRequiredQuantity(2, 5), 3);
assert.equal(stockRequiredQuantity(8, 5), 0);
assert.equal(stockRequiredQuantity(0, 0), 0);

const products: Product[] = [
  product({
    id: "a",
    name: "نظارة كلاسيك",
    sku: "OY-100",
    color: "أسود",
    frameSize: "051/015",
    stockQuantity: 2,
    minimumStock: 5,
    sellingPrice: 250,
  }),
  product({
    id: "b",
    name: "Sunglasses Gold",
    sku: "OY-200",
    category: "Sunglasses",
    color: "Gold",
    frameSize: "052-018",
    stockQuantity: 0,
    minimumStock: 3,
    sellingPrice: 320,
  }),
  product({
    id: "c",
    name: "Spare",
    sku: "",
    stockQuantity: 12,
    minimumStock: 4,
    sellingPrice: 90,
  }),
];

const rows = buildStockExportRows(products, {
  locale: "ar",
  categoryLabel: (value) => value,
  statusLabel: (level) =>
    level === "in" ? "متوفر" : level === "low" ? "منخفض" : "غير متوفر",
});

assert.equal(rows.length, 3);
assert.equal(rows[0]?.requiredQuantity, 3);
assert.equal(rows[0]?.frameSize, "51/15");
assert.equal(rows[1]?.requiredQuantity, 3);
assert.equal(rows[1]?.frameSize, "52/18");
assert.equal(rows[2]?.productNumber, "—");
assert.equal(rows[2]?.requiredQuantity, 0);

const summary = summarizeStockExportRows(rows);
assert.equal(summary.totalQty, 14);
assert.equal(summary.outOfStock, 1);
assert.equal(summary.lowStock, 1);
assert.equal(summary.inStock, 1);
assert.equal(summary.requiredTotal, 6);

const fonts = {
  latin: new Uint8Array(readFileSync("public/fonts/NotoSans-Regular.ttf")),
  latinBold: new Uint8Array(readFileSync("public/fonts/NotoSans-Bold.ttf")),
  hebrew: new Uint8Array(readFileSync("public/fonts/NotoSansHebrew-Regular.ttf")),
  hebrewBold: new Uint8Array(readFileSync("public/fonts/NotoSansHebrew-Bold.ttf")),
  arabic: new Uint8Array(readFileSync("public/fonts/NotoNaskhArabic-Regular.ttf")),
};
const logo = new Uint8Array(readFileSync("public/images/oyon-order-logo.png"));

const labels: StockExportLabels = {
  titleAr: "تقرير مخزون عيون أوبتيكس",
  titleEn: "OYON OPTICS Stock Report",
  reportDate: "تاريخ التقرير",
  totalQty: "إجمالي الكمية",
  inStock: "متوفر",
  lowStock: "مخزون منخفض",
  outOfStock: "غير متوفر",
  colImage: "الصورة",
  colName: "المنتج",
  colNumber: "رقم المنتج",
  colCategory: "التصنيف",
  colColor: "اللون",
  colSize: "مقاس العدسة",
  colPrice: "السعر",
  colStock: "الكمية",
  colMin: "الحد الأدنى",
  colRequired: "الكمية المطلوبة",
  colStatus: "الحالة",
  statusIn: "متوفر",
  statusLow: "مخزون منخفض",
  statusOut: "غير متوفر",
  empty: "لا توجد منتجات",
  website: "www.oyonoptics.com",
  location: "دير حنا / Dir Hanna, Israel",
  sheetName: "المخزون",
  pdfFilename: "oyon-stock-test.pdf",
  xlsxFilename: "oyon-stock-test.xlsx",
};

const many = Array.from({ length: 28 }, (_, index) =>
  product({
    id: `p-${index}`,
    name: `منتج ${index + 1}`,
    sku: `NO-${100 + index}`,
    stockQuantity: index % 5,
    minimumStock: 4,
    sellingPrice: 100 + index,
    color: index % 2 ? "أسود" : "ذهبي",
    frameSize: index % 2 ? "051/015" : "052-018",
  }),
);
const manyRows = buildStockExportRows(many, {
  locale: "ar",
  categoryLabel: (value) => value,
  statusLabel: (level) =>
    level === "in" ? "متوفر" : level === "low" ? "منخفض" : "غير متوفر",
});

const pdf = buildStockReportPdf({
  rows: manyRows,
  labels,
  locale: "ar",
  fonts,
  logo,
  generatedAt: new Date("2026-10-16T12:00:00.000Z"),
});
assert.equal(Buffer.from(pdf.bytes.subarray(0, 5)).toString("latin1"), "%PDF-");
assert.ok(pdf.pageCount >= 2, `expected multipage PDF, got ${pdf.pageCount}`);

async function main() {
  const xlsx = await buildStockReportXlsx({
    rows: manyRows,
    labels,
    locale: "ar",
    generatedAt: new Date("2026-10-16T12:00:00.000Z"),
  });
  assert.equal(xlsx.bytes[0], 0x50);
  assert.equal(xlsx.bytes[1], 0x4b);
  assert.ok(xlsx.bytes.byteLength > 2000);

  const out = "/opt/cursor/artifacts";
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "oyon-stock-report-sample.pdf"), pdf.bytes);
  writeFileSync(join(out, "oyon-stock-report-sample.xlsx"), xlsx.bytes);

  const page = readFileSync("app/admin/stock/page.tsx", "utf8");
  assert.match(page, /downloadStockReportPdf/);
  assert.match(page, /downloadStockReportXlsx/);
  assert.doesNotMatch(page, /exportCsv\(/);
  assert.match(page, /admin\.stock\.exportPdf/);
  assert.match(page, /admin\.stock\.exportExcel/);
  assert.doesNotMatch(
    readFileSync("lib/stock-report-xlsx.ts", "utf8"),
    /autoFilter/,
  );
  assert.match(readFileSync("lib/stock-report-pdf.ts", "utf8"), /drawTableHeadLabel/);
  assert.match(readFileSync("lib/stock-report-pdf.ts", "utf8"), /drawPositionedText/);
  assert.match(
    readFileSync("lib/stock-report-pdf.ts", "utf8"),
    /data\.cell\.text = \[\]/,
  );
  const arDict = readFileSync("lib/i18n/dictionaries/ar.ts", "utf8");
  assert.match(arDict, /تقرير مخزون عيون أوبتيكس/);

  console.log(
    JSON.stringify({
      stockExport: "pass",
      pdfPages: pdf.pageCount,
      pdfBytes: pdf.bytes.byteLength,
      xlsxBytes: xlsx.bytes.byteLength,
    }),
  );
}

void main();

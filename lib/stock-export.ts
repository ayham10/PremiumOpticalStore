import { formatFrameSizePublic } from "@/lib/product-fields";
import { productDisplayImage } from "@/lib/product-images";
import { resolveProductCopy } from "@/lib/product-i18n";
import {
  getStockLevel,
  productLowStockThreshold,
  productStockQuantity,
  type StockLevel,
} from "@/lib/stock-status";
import type { CategoryDefaultImages, Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

export const STOCK_EXPORT_WEBSITE = "www.oyonoptics.com";
export const STOCK_EXPORT_LOCATION_AR = "دير حنا";
export const STOCK_EXPORT_LOCATION_HE = "דייר חנא";
export const STOCK_EXPORT_LOCATION_EN = "Dir Hanna, Israel";
export const STOCK_EXPORT_BRAND_EN = "OYON OPTICS";
export const STOCK_EXPORT_BRAND_AR = "عيون أوبتكس";
export const STOCK_EXPORT_BRAND_HE = "עיון אופטיקה";

export type StockExportLabels = {
  titleAr: string;
  titleEn: string;
  reportDate: string;
  totalQty: string;
  inStock: string;
  lowStock: string;
  outOfStock: string;
  colImage: string;
  colName: string;
  colNumber: string;
  colCategory: string;
  colColor: string;
  colSize: string;
  colPrice: string;
  colStock: string;
  colMin: string;
  colRequired: string;
  colStatus: string;
  statusIn: string;
  statusLow: string;
  statusOut: string;
  empty: string;
  website: string;
  location: string;
  sheetName: string;
  pdfFilename: string;
  xlsxFilename: string;
};

export type StockExportRow = {
  id: string;
  name: string;
  productNumber: string;
  category: string;
  color: string;
  frameSize: string;
  price: number;
  stockQuantity: number;
  minimumStock: number;
  requiredQuantity: number;
  level: StockLevel;
  statusLabel: string;
  imageUrl: string;
};

export type StockExportSummary = {
  totalQty: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  requiredTotal: number;
};

export function stockRequiredQuantity(
  stockQuantity?: number | null,
  minimumStock?: number | null,
): number {
  const qty = productStockQuantity(stockQuantity);
  const min = productLowStockThreshold(minimumStock);
  return Math.max(min - qty, 0);
}

export function dashOr(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

/** PDF rows keep catalog names/SKU/colors as stored; labels are Hebrew-fixed separately. */
export function buildStockExportRowsForPdf(
  products: Product[],
  options: {
    categoryLabel: (category: string) => string;
    statusLabel: (level: StockLevel) => string;
    defaults?: CategoryDefaultImages | null;
  },
): StockExportRow[] {
  return products.map((product) => {
    const stockQuantity = productStockQuantity(product.stockQuantity);
    const minimumStock = productLowStockThreshold(product.minimumStock);
    const level = getStockLevel(product.stockQuantity, product.minimumStock);
    return {
      id: product.id,
      name: dashOr(product.name),
      productNumber: dashOr(product.sku),
      category: dashOr(options.categoryLabel(product.category)),
      color: dashOr(product.color),
      frameSize: dashOr(formatFrameSizePublic(product.frameSize)),
      price: Number.isFinite(product.sellingPrice) ? product.sellingPrice : 0,
      stockQuantity,
      minimumStock,
      requiredQuantity: stockRequiredQuantity(
        product.stockQuantity,
        product.minimumStock,
      ),
      level,
      statusLabel: options.statusLabel(level),
      imageUrl: productDisplayImage(product, options.defaults),
    };
  });
}

export function buildStockExportRows(
  products: Product[],
  options: {
    locale: Locale;
    categoryLabel: (category: string) => string;
    statusLabel: (level: StockLevel) => string;
    defaults?: CategoryDefaultImages | null;
  },
): StockExportRow[] {
  return products.map((product) => {
    const copy = resolveProductCopy(product, options.locale);
    const stockQuantity = productStockQuantity(product.stockQuantity);
    const minimumStock = productLowStockThreshold(product.minimumStock);
    const level = getStockLevel(product.stockQuantity, product.minimumStock);
    return {
      id: product.id,
      name: dashOr(copy.name || product.name),
      productNumber: dashOr(product.sku),
      category: dashOr(options.categoryLabel(product.category)),
      color: dashOr(copy.color || product.color),
      frameSize: dashOr(formatFrameSizePublic(product.frameSize)),
      price: Number.isFinite(product.sellingPrice) ? product.sellingPrice : 0,
      stockQuantity,
      minimumStock,
      requiredQuantity: stockRequiredQuantity(
        product.stockQuantity,
        product.minimumStock,
      ),
      level,
      statusLabel: options.statusLabel(level),
      imageUrl: productDisplayImage(product, options.defaults),
    };
  });
}

export function summarizeStockExportRows(
  rows: StockExportRow[],
): StockExportSummary {
  let totalQty = 0;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let requiredTotal = 0;
  for (const row of rows) {
    totalQty += row.stockQuantity;
    requiredTotal += row.requiredQuantity;
    if (row.level === "in") inStock += 1;
    else if (row.level === "low") lowStock += 1;
    else outOfStock += 1;
  }
  return { totalQty, inStock, lowStock, outOfStock, requiredTotal };
}

export function stockExportDateLabel(date: Date, locale: Locale): string {
  const tag = locale === "ar" ? "ar" : locale === "he" ? "he" : "en-GB";
  return date.toLocaleDateString(tag, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function stockStatusFill(level: StockLevel): {
  fill: [number, number, number];
  text: [number, number, number];
} {
  if (level === "in") {
    return { fill: [232, 246, 239], text: [34, 120, 84] };
  }
  if (level === "low") {
    return { fill: [252, 243, 220], text: [150, 110, 20] };
  }
  return { fill: [250, 232, 232], text: [170, 60, 60] };
}

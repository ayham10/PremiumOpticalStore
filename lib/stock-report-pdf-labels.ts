import {
  STOCK_EXPORT_LOCATION_EN,
  STOCK_EXPORT_LOCATION_HE,
  STOCK_EXPORT_WEBSITE,
  type StockExportLabels,
} from "@/lib/stock-export";
import type { StockLevel } from "@/lib/stock-status";

/** Fixed Hebrew copy for the stock PDF (independent of admin UI locale). */
export const STOCK_REPORT_PDF_TITLE_HE = "דוח מלאי – עיון אופטיקה";

const STOCK_PDF_CATEGORY_HE: Record<string, string> = {
  Sunglasses: "משקפי שמש",
  "Prescription Glasses": "משקפי ראייה",
  Frames: "מסגרות",
  Accessories: "אביזרים",
  "Contact Lenses": "עדשות מגע",
  "Cleaning Products": "מוצרי ניקוי",
};

export function stockReportPdfCategoryHe(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "—";
  return STOCK_PDF_CATEGORY_HE[trimmed] ?? trimmed;
}

export function stockReportPdfStatusHe(level: StockLevel): string {
  if (level === "in") return "זמין";
  if (level === "low") return "מלאי נמוך";
  return "אזל מהמלאי";
}

export function stockReportPdfLabels(
  pdfFilename: string,
  xlsxFilename: string,
): StockExportLabels {
  return {
    titleAr: STOCK_REPORT_PDF_TITLE_HE,
    titleEn: "",
    reportDate: "תאריך הדוח",
    totalQty: "סה״כ כמות במלאי",
    inStock: "מוצרים זמינים",
    lowStock: "מלאי נמוך",
    outOfStock: "מוצרים שאזלו",
    colImage: "תמונה",
    colName: "מוצר",
    colNumber: "מספר מוצר",
    colCategory: "קטגוריה",
    colColor: "צבע",
    colSize: "מידת מסגרת",
    colPrice: "מחיר",
    colStock: "כמות",
    colMin: "מלאי מינימלי",
    colRequired: "כמות להזמנה",
    colStatus: "סטטוס",
    statusIn: "זמין",
    statusLow: "מלאי נמוך",
    statusOut: "אזל מהמלאי",
    empty: "אין מוצרים להצגה בדוח.",
    website: STOCK_EXPORT_WEBSITE,
    location: `${STOCK_EXPORT_LOCATION_HE} / ${STOCK_EXPORT_LOCATION_EN}`,
    sheetName: "מלאי",
    pdfFilename,
    xlsxFilename,
  };
}

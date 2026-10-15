import type { LensOrderRow } from "@/lib/lens-inventory";
import {
  buildLensOrderPdf,
  type LensOrderPdfFonts,
} from "@/lib/lens-order-pdf";

async function fetchFont(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load font ${path}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadLensOrderPdfFonts(): Promise<LensOrderPdfFonts> {
  const [latin, hebrew, arabic] = await Promise.all([
    fetchFont("/fonts/NotoSans-Regular.ttf"),
    fetchFont("/fonts/NotoSansHebrew-Regular.ttf"),
    fetchFont("/fonts/NotoNaskhArabic-Regular.ttf"),
  ]);
  return { latin, hebrew, arabic };
}

export async function downloadLensOrderPdf(
  rows: LensOrderRow[],
  generatedAt = new Date(),
): Promise<void> {
  const fonts = await loadLensOrderPdfFonts();
  const { bytes, filename } = buildLensOrderPdf(rows, { generatedAt, fonts });
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

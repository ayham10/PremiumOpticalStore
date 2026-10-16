import type { LensOrderRow } from "@/lib/lens-inventory";
import {
  buildLensOrderPdf,
  type LensOrderPdfFonts,
} from "@/lib/lens-order-pdf";

async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadLensOrderPdfFonts(): Promise<LensOrderPdfFonts> {
  const [latin, hebrew, arabic] = await Promise.all([
    fetchBytes("/fonts/NotoSans-Regular.ttf"),
    fetchBytes("/fonts/NotoSansHebrew-Regular.ttf"),
    fetchBytes("/fonts/NotoNaskhArabic-Regular.ttf"),
  ]);
  return { latin, hebrew, arabic };
}

export async function loadLensOrderPdfLogo(): Promise<Uint8Array> {
  return fetchBytes("/images/oyon-order-logo.png");
}

function pdfBlobFromBytes(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

export async function createLensOrderPdf(
  rows: LensOrderRow[],
  options: { generatedAt?: Date; phone?: string | null } = {},
) {
  const [fonts, logo] = await Promise.all([
    loadLensOrderPdfFonts(),
    loadLensOrderPdfLogo(),
  ]);
  return buildLensOrderPdf(rows, {
    generatedAt: options.generatedAt,
    phone: options.phone,
    fonts,
    logo,
  });
}

export async function downloadLensOrderPdf(
  rows: LensOrderRow[],
  options: { generatedAt?: Date; phone?: string | null } = {},
): Promise<void> {
  const { bytes, filename } = await createLensOrderPdf(rows, options);
  const url = URL.createObjectURL(pdfBlobFromBytes(bytes));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function printPdfUrl(url: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print lens order list");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };
  iframe.onload = () => {
    const frameWin = iframe.contentWindow;
    if (!frameWin) {
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(cleanup, 60_000);
      return;
    }
    frameWin.focus();
    frameWin.print();
    frameWin.addEventListener("afterprint", cleanup);
    window.setTimeout(cleanup, 120_000);
  };
  document.body.appendChild(iframe);
}

export async function printLensOrderPdf(
  rows: LensOrderRow[],
  options: { generatedAt?: Date; phone?: string | null } = {},
): Promise<void> {
  const { bytes } = await createLensOrderPdf(rows, options);
  const url = URL.createObjectURL(pdfBlobFromBytes(bytes));
  printPdfUrl(url);
}

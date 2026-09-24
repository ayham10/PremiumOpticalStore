/** International digits for api.whatsapp.com (no +, spaces, or leading 0). */
export function storeWhatsAppDigits(raw?: string | null): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) digits = `972${digits}`;
  return digits;
}

/** Mobile-safe inquire URL used by the product WhatsApp button and the storefront FAB. */
export function storeWhatsAppHref(
  rawPhone: string | undefined,
  text: string,
): string {
  const phone = storeWhatsAppDigits(rawPhone);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

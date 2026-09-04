/**
 * Normalize Israeli mobile numbers for whatsapp-web.js chat IDs.
 * Returns digits-only international format: 9725XXXXXXXX
 */
function normalizeIsraeliWhatsAppNumber(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return null;

  if (/^9725\d{8}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  if (/^05\d{8}$/.test(digitsOnly)) {
    return `972${digitsOnly.slice(1)}`;
  }

  if (/^5\d{8}$/.test(digitsOnly)) {
    return `972${digitsOnly}`;
  }

  if (trimmed.startsWith("+")) {
    const plusDigits = trimmed.slice(1).replace(/\D/g, "");
    if (/^9725\d{8}$/.test(plusDigits)) {
      return plusDigits;
    }
  }

  return null;
}

function toWhatsAppChatId(input) {
  const normalized = normalizeIsraeliWhatsAppNumber(input);
  if (!normalized) return null;
  return `${normalized}@c.us`;
}

module.exports = {
  normalizeIsraeliWhatsAppNumber,
  toWhatsAppChatId,
};

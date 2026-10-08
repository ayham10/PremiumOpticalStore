/** Twilio Content SIDs are HX followed by 32 alphanumeric characters. */
export function sanitizeTwilioContentSid(
  value?: string | null,
): string | null {
  const sid = (value || "").trim();
  if (/^HX[A-Za-z0-9]{32}$/.test(sid)) return sid;
  return null;
}

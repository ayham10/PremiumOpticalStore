/** Runtime lookup — avoids Next.js build-time inlining when vars are set only on Vercel. */
export function serverEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
};

export function normalizeWhatsAppAddress(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `whatsapp:+${digits}`;
}

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = serverEnv("TWILIO_ACCOUNT_SID");
  const authToken = serverEnv("TWILIO_AUTH_TOKEN");
  const whatsappFromRaw = serverEnv("TWILIO_WHATSAPP_FROM");
  const whatsappFrom = normalizeWhatsAppAddress(whatsappFromRaw);

  if (!accountSid || !authToken || !whatsappFrom) return null;

  return { accountSid, authToken, whatsappFrom };
}

export function isTwilioWhatsAppConfigured(): boolean {
  return getTwilioConfig() !== null;
}

export function twilioBasicAuth(config: TwilioConfig): string {
  return Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
}

import type { AppData } from "@/lib/types";

export type E2EOutboundKind = "sms" | "whatsapp";

const tokens = new Map<string, string>();
const outbounds: Array<{ kind: E2EOutboundKind; detail: string }> = [];
let isolated: AppData | null = null;

export function isBookingE2EIsolated(): boolean {
  return (
    process.env.BOOKING_E2E_ISOLATED === "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}

export function beginIsolatedStore(data: AppData): void {
  if (!isBookingE2EIsolated()) {
    throw new Error(
      "Isolated E2E store requires BOOKING_E2E_ISOLATED=1 and non-production VERCEL_ENV",
    );
  }
  isolated = structuredClone(data);
  tokens.clear();
  outbounds.length = 0;
}

export function endIsolatedStore(): void {
  isolated = null;
  tokens.clear();
  outbounds.length = 0;
}

export function getIsolatedStore(): AppData | null {
  return isolated;
}

export function setIsolatedStore(data: AppData): void {
  isolated = data;
}

export function recordE2EManageToken(appointmentId: string, token: string): void {
  if (!isBookingE2EIsolated()) return;
  tokens.set(appointmentId, token);
}

export function takeE2EManageToken(appointmentId: string): string | undefined {
  return tokens.get(appointmentId);
}

export function recordE2EOutbound(kind: E2EOutboundKind, detail: string): void {
  if (!isBookingE2EIsolated()) return;
  outbounds.push({ kind, detail });
}

export function getE2EOutbounds(): Array<{ kind: E2EOutboundKind; detail: string }> {
  return [...outbounds];
}

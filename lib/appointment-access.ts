import { randomBytes } from "crypto";
import type { Appointment } from "@/lib/types";

export type StaffAppointmentView = Omit<Appointment, "manageToken"> & {
  staffName: string | null;
};

/** 256-bit token for newly created staff calendar rows. Existing stored tokens are not rewritten. */
export function generateLegacyAppointmentManageToken(): string {
  return randomBytes(32).toString("base64url");
}

export function toStaffAppointmentView(
  appointment: Appointment,
  staffName?: string,
): StaffAppointmentView {
  const { manageToken, ...rest } = appointment;
  void manageToken;
  return { ...rest, staffName: staffName || null };
}

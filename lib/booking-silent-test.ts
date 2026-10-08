/** Admin-only manage-flow fixtures. Never message. Safe to delete. */
export const SILENT_MANAGE_TEST_ID_PREFIX = "eea_test_";
export const SILENT_MANAGE_TEST_MAX_APPOINTMENTS = 3;
export const SILENT_MANAGE_TEST_PHONE = "+972500000099";
export const SILENT_MANAGE_TEST_EMAIL = "silent-manage-test@oyonoptics.invalid";
export const SILENT_MANAGE_TEST_NOTES =
  "[SILENT-TEST] Admin booking-manage fixture. No WhatsApp/SMS. Safe to delete.";

export function isSilentManageTestAppointment(appointment: {
  silentTest?: boolean;
  id?: string;
}): boolean {
  return (
    appointment.silentTest === true ||
    Boolean(appointment.id?.startsWith(SILENT_MANAGE_TEST_ID_PREFIX))
  );
}

export function customerFacingAppointments<T extends { silentTest?: boolean; id?: string }>(
  appointments: T[],
): T[] {
  return appointments.filter((item) => !isSilentManageTestAppointment(item));
}

export function capSilentManageTestAppointments<
  T extends { silentTest?: boolean; id?: string },
>(appointments: T[], max = SILENT_MANAGE_TEST_MAX_APPOINTMENTS): T[] {
  const silent = appointments.filter(isSilentManageTestAppointment);
  const live = appointments.filter((item) => !isSilentManageTestAppointment(item));
  return [...silent.slice(0, max), ...live];
}

type FingerprintAppointment = {
  silentTest?: boolean;
  id?: string;
  status?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  updatedAt?: string;
  manageTokenHash?: string;
};

export function customerAppointmentFingerprint(
  appointments: FingerprintAppointment[],
): string {
  return customerFacingAppointments(appointments)
    .map((item) =>
      [
        item.id,
        item.status,
        item.appointmentDate,
        item.appointmentTime,
        item.updatedAt,
        item.manageTokenHash || "",
      ].join(":"),
    )
    .join("|");
}

export function assertCustomerAppointmentsPreserved(
  before: FingerprintAppointment[],
  after: FingerprintAppointment[],
): void {
  if (customerAppointmentFingerprint(before) !== customerAppointmentFingerprint(after)) {
    throw new Error("CUSTOMER_BOOKING_MUTATION");
  }
}

export function removeSilentManageTestAppointment<T extends FingerprintAppointment>(
  appointments: T[],
  id: string,
): T[] {
  const index = appointments.findIndex(
    (item) => item.id === id && isSilentManageTestAppointment(item),
  );
  if (index < 0) throw new Error("NOT_FOUND");
  return appointments.filter((_, i) => i !== index);
}

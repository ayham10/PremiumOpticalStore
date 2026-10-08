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

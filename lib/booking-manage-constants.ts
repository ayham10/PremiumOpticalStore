export const BOOKING_MANAGE_ORIGIN = "https://oyonoptics.com";
export const BOOKING_MANAGE_PATH = "/appointments/manage";
/** Existing customer/admin management links. */
export const BOOKING_MANAGE_CTA_URL = `${BOOKING_MANAGE_ORIGIN}${BOOKING_MANAGE_PATH}/{{5}}`;
/**
 * Approved Twilio/Meta button URL path. Existing /appointments/manage links
 * stay valid; this path must also open the same booking.
 */
export const TWILIO_APPROVED_MANAGE_PATH = "/booking/manage";
export const TWILIO_APPROVED_MANAGE_CTA_URL = `${BOOKING_MANAGE_ORIGIN}${TWILIO_APPROVED_MANAGE_PATH}/{{5}}`;
export const CUSTOMER_MANAGE_TEMPLATE_NAME_AR = "oyon_booking_manage_v2_ar";
export const CUSTOMER_MANAGE_TEMPLATE_NAME_HE = "oyon_booking_manage_v2_he";
export const OWNER_RESCHEDULED_TEMPLATE_NAME = "oyon_booking_rescheduled_owner";
export const OWNER_CANCELLED_TEMPLATE_NAME = "oyon_booking_cancelled_owner";
/** Default / Arabic pending template. Hebrew uses CUSTOMER_MANAGE_TEMPLATE_NAME_HE. */
export const CUSTOMER_MANAGE_TEMPLATE_NAME = CUSTOMER_MANAGE_TEMPLATE_NAME_AR;
/** Management links expire at the appointment start (Asia/Jerusalem). */
export const EXPIRED_MANAGE_LINK_MESSAGE =
  "انتهت صلاحية رابط إدارة الموعد. بعد حلول وقت الموعد لم يعد بالإمكان عرض الحجز أو إلغاؤه أو إعادة جدولته. للاستفسار، يرجى التواصل مع عيون أوبتيكا.";
export const EXPIRED_MANAGE_LINK_MESSAGE_HE =
  "תוקף קישור ניהול התור פג. לאחר שעת התחלת התור לא ניתן עוד לצפות בו, לבטל אותו או לשנות את המועד. לשאלות ניתן לפנות ל־עיון אופטיקה.";
export const EXPIRED_MANAGE_LINK_MESSAGE_EN =
  "This appointment management link has expired. Once the appointment start time is reached, the booking can no longer be viewed, cancelled, or rescheduled. Please contact OYON Optics if you need assistance.";
export const REVOKED_MANAGE_LINK_MESSAGE = EXPIRED_MANAGE_LINK_MESSAGE;

export function isCustomerManagePath(pathname: string): boolean {
  return (
    pathname.startsWith(BOOKING_MANAGE_PATH) ||
    pathname.startsWith(TWILIO_APPROVED_MANAGE_PATH)
  );
}

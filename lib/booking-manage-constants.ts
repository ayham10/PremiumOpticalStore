export const BOOKING_MANAGE_ORIGIN = "https://oyonoptics.com";
export const BOOKING_MANAGE_PATH = "/appointments/manage";
/** Twilio CTA dynamic URL: production domain + path + {{5}} token parameter. */
export const BOOKING_MANAGE_CTA_URL = `${BOOKING_MANAGE_ORIGIN}${BOOKING_MANAGE_PATH}/{{5}}`;
export const CUSTOMER_MANAGE_TEMPLATE_NAME_AR = "oyon_booking_manage_v2_ar";
export const CUSTOMER_MANAGE_TEMPLATE_NAME_HE = "oyon_booking_manage_v2_he";
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

export const BOOKING_MANAGE_ORIGIN = "https://oyonoptics.com";
export const BOOKING_MANAGE_PATH = "/appointments/manage";
/** Twilio CTA dynamic URL: production domain + path + {{5}} token parameter. */
export const BOOKING_MANAGE_CTA_URL = `${BOOKING_MANAGE_ORIGIN}${BOOKING_MANAGE_PATH}/{{5}}`;
export const CUSTOMER_MANAGE_TEMPLATE_NAME_AR = "oyon_booking_manage_v2_ar";
export const CUSTOMER_MANAGE_TEMPLATE_NAME_HE = "oyon_booking_manage_v2_he";
/** Default / Arabic pending template. Hebrew uses CUSTOMER_MANAGE_TEMPLATE_NAME_HE. */
export const CUSTOMER_MANAGE_TEMPLATE_NAME = CUSTOMER_MANAGE_TEMPLATE_NAME_AR;
export const MANAGE_TOKEN_TTL_AFTER_END_MS = 24 * 60 * 60 * 1000;
export const EXPIRED_MANAGE_LINK_MESSAGE =
  "انتهت صلاحية رابط إدارة الموعد. للاستفسار، يرجى التواصل مع عيون أوبتيكا.";
export const REVOKED_MANAGE_LINK_MESSAGE = EXPIRED_MANAGE_LINK_MESSAGE;

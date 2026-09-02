"use client";

import { Clock, Map, MapPin, Navigation, Phone } from "lucide-react";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatLocalPhone, phoneTelHref } from "@/lib/format";
import { buildPublicHoursLines } from "@/lib/working-hours";

const MAPS_URL = "https://maps.app.goo.gl/wjbQSBYvR2fCidLq8";
const WAZE_URL =
  "https://waze.com/ul?ll=32.861202%2C35.363229&navigate=yes";

export default function Footer() {
  const { t } = useLocale();
  const { branding, settings } = useBranding();
  const phone = settings?.phone || "+972-52-123-4567";
  const city = settings?.city || t("footer.city");
  const hourLines = buildPublicHoursLines(
    settings?.openingHours,
    (day) => t(`days.${day}`),
    t("contact.closed"),
  );
  const mapsUrl = settings?.googleMapsLink || MAPS_URL;
  const instagramUrl = settings?.social?.instagram?.trim() || "";
  const phoneDisplay = formatLocalPhone(phone);
  const phoneHref = phoneTelHref(phone);

  return (
    <footer className="oyon-footer">
      <div className="oyon-footer-inner wrap">
        <div className="oyon-footer-brand">
          <BrandMark branding={branding} href="/" size="lg" onDark />
          <p className="oyon-footer-tagline">{t("footer.tagline")}</p>
        </div>

        <div className="oyon-footer-info" dir="rtl">
          <div className="oyon-footer-hours-card">
            <p className="oyon-footer-heading">
              <Clock className="oyon-footer-icon" size={16} strokeWidth={1.75} aria-hidden />
              <span>{t("footer.hours")}</span>
            </p>
            {hourLines.length ? (
              <div className="oyon-footer-hours" dir="rtl">
                {hourLines.map((line) => (
                  <span key={line.key} className="oyon-footer-hours-line">
                    <strong>{line.label}</strong>
                    {line.closed ? (
                      <span className="oyon-footer-hours-closed">{line.value}</span>
                    ) : (
                      <span className="oyon-footer-hours-value" dir="ltr">
                        {line.value.split(" / ").map((period, index, periods) => (
                          <span key={`${line.key}-${index}`}>
                            {period}
                            {index < periods.length - 1 ? (
                              <span className="oyon-footer-hours-sep" aria-hidden>
                                {" • "}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="oyon-footer-hours-fallback" dir="ltr">
                {t("footer.hoursValue")}
              </span>
            )}
          </div>

          <div className="oyon-footer-contact">
            <div className="oyon-footer-contact-row">
              <div className="oyon-footer-contact-side">
                <span className="oyon-footer-icon-ring" aria-hidden>
                  <Phone className="oyon-footer-icon" size={14} strokeWidth={1.75} />
                </span>
                <span className="oyon-footer-kicker">{t("footer.phone")}</span>
              </div>
              <a className="oyon-footer-value" href={phoneHref || undefined} dir="ltr">
                {phoneDisplay}
              </a>
            </div>

            <div className="oyon-footer-contact-row">
              <div className="oyon-footer-contact-side">
                <span className="oyon-footer-icon-ring" aria-hidden>
                  <MapPin className="oyon-footer-icon" size={14} strokeWidth={1.75} />
                </span>
                <span className="oyon-footer-kicker">{t("footer.location")}</span>
              </div>
              <span className="oyon-footer-value">{city}</span>
            </div>
          </div>
        </div>

        <div className="oyon-footer-actions">
          <div className="oyon-footer-map-actions">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="oyon-footer-map-btn"
            >
              <Map size={18} strokeWidth={1.75} aria-hidden />
              {t("footer.maps")}
            </a>
            <a
              href={WAZE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="oyon-footer-map-btn"
            >
              <Navigation size={18} strokeWidth={1.75} aria-hidden />
              {t("footer.waze")}
            </a>
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="oyon-footer-map-btn"
                aria-label="Instagram"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                Instagram
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="oyon-footer-copy">
        <div className="wrap">
          <p className="oyon-footer-legal-name">OYON Optics | עיון אופטיקה</p>
          <p className="oyon-footer-legal-reg" dir="rtl">
            שם העוסק הרשום: דגש ענאן | כינוי העסק: עיון אופטיקה
          </p>
          <p>{t("footer.copyright", { year: 2026 })}</p>
        </div>
      </div>
    </footer>
  );
}

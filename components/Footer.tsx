"use client";

import { MapPin, Navigation } from "lucide-react";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";

const MAPS_URL = "https://maps.app.goo.gl/wjbQSBYvR2fCidLq8";
const WAZE_URL =
  "https://waze.com/ul?ll=32.861202%2C35.363229&navigate=yes";

export default function Footer() {
  const { t } = useLocale();
  const { branding, settings } = useBranding();
  const phone = settings?.phone || "+972-52-123-4567";
  const city = settings?.city || t("footer.city");
  const hours = t("footer.hoursValue");
  const mapsUrl = settings?.googleMapsLink || MAPS_URL;

  return (
    <footer className="oyon-footer">
      <div className="oyon-footer-inner wrap">
        <div className="oyon-footer-brand">
          <BrandMark branding={branding} href="/" size="lg" onDark />
          <p className="oyon-footer-tagline">{t("footer.tagline")}</p>
        </div>

        <div className="oyon-footer-info">
          <p className="oyon-footer-info-row">
            <span className="oyon-footer-label">{t("footer.hours")}</span>
            <span dir="ltr">{hours}</span>
          </p>
          <p className="oyon-footer-info-row">
            <span className="oyon-footer-label">{t("footer.phone")}</span>
            <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr">
              {phone}
            </a>
          </p>
          <p className="oyon-footer-info-row">
            <span className="oyon-footer-label">{t("footer.location")}</span>
            <span>{city}</span>
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="oyon-footer-show-location"
          >
            {t("footer.showLocation")}
          </a>
        </div>

        <div className="oyon-footer-actions">
          <div className="oyon-footer-map-actions">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="oyon-footer-map-btn"
            >
              <MapPin size={15} aria-hidden />
              {t("footer.maps")}
            </a>
            <a
              href={WAZE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="oyon-footer-map-btn"
            >
              <Navigation size={15} aria-hidden />
              {t("footer.waze")}
            </a>
          </div>
        </div>
      </div>

      <div className="oyon-footer-copy">
        <div className="wrap">
          <p>{t("footer.copyright", { year: 2026 })}</p>
        </div>
      </div>
    </footer>
  );
}

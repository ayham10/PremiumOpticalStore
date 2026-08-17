"use client";

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Eye,
  Glasses,
  Heart,
  MessageCircle,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
} from "lucide-react";
import { BOOKING_SERVICE_ICON_IDS, type BookingServiceIconId } from "@/lib/booking-services";

const ICON_MAP: Record<BookingServiceIconId, LucideIcon> = {
  eye: Eye,
  "contact-lenses": Sparkles,
  glasses: Glasses,
  sun: Sun,
  stethoscope: Stethoscope,
  calendar: Calendar,
  heart: Heart,
  star: Star,
  "message-circle": MessageCircle,
  sparkles: Sparkles,
};

export function resolveBookingServiceIcon(icon?: string): LucideIcon {
  if (icon && icon in ICON_MAP) {
    return ICON_MAP[icon as BookingServiceIconId];
  }
  return Calendar;
}

export function BookingServiceIconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (icon: BookingServiceIconId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="admin-bsvc-icon-grid" role="listbox" aria-label="Icon">
      {BOOKING_SERVICE_ICON_IDS.map((iconId) => {
        const Icon = ICON_MAP[iconId];
        const active = value === iconId;
        return (
          <button
            key={iconId}
            type="button"
            role="option"
            aria-selected={active}
            disabled={disabled}
            className={`admin-bsvc-icon-btn${active ? " is-active" : ""}`}
            onClick={() => onChange(iconId)}
          >
            <Icon size={18} strokeWidth={1.6} />
          </button>
        );
      })}
    </div>
  );
}

export function BookingServiceIcon({
  icon,
  size = 20,
  className,
}: {
  icon?: string;
  size?: number;
  className?: string;
}) {
  const Icon = resolveBookingServiceIcon(icon);
  return <Icon size={size} strokeWidth={1.6} className={className} aria-hidden />;
}

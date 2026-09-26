import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  CalendarCheck2,
  CircleCheck,
  Clock3,
  Crosshair,
  Droplets,
  Eye,
  Glasses,
  Heart,
  HeartHandshake,
  Package,
  Ruler,
  ScanEye,
  Shield,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  Sun,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

export const SERVICE_FEATURE_ICON_IDS = [
  "user-round",
  "clock-3",
  "shield-check",
  "eye",
  "ruler",
  "droplets",
  "heart-handshake",
  "glasses",
  "scan-eye",
  "timer",
  "shield",
  "badge-check",
  "calendar-check-2",
  "sparkles",
  "stethoscope",
  "sun",
  "activity",
  "crosshair",
  "users",
  "heart",
  "circle-check",
  "smile",
  "package",
] as const;

export type ServiceFeatureIconId = (typeof SERVICE_FEATURE_ICON_IDS)[number];

export const SERVICE_FEATURE_ICONS: Record<ServiceFeatureIconId, LucideIcon> = {
  "user-round": UserRound,
  "clock-3": Clock3,
  "shield-check": ShieldCheck,
  eye: Eye,
  ruler: Ruler,
  droplets: Droplets,
  "heart-handshake": HeartHandshake,
  glasses: Glasses,
  "scan-eye": ScanEye,
  timer: Timer,
  shield: Shield,
  "badge-check": BadgeCheck,
  "calendar-check-2": CalendarCheck2,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  sun: Sun,
  activity: Activity,
  crosshair: Crosshair,
  users: Users,
  heart: Heart,
  "circle-check": CircleCheck,
  smile: Smile,
  package: Package,
};

export const EYE_EXAM_DEFAULT_FEATURE_ICONS = [
  "user-round",
  "clock-3",
  "shield-check",
  "eye",
] as const satisfies readonly ServiceFeatureIconId[];

export const CONTACT_LENSES_DEFAULT_FEATURE_ICONS = [
  "ruler",
  "droplets",
  "heart-handshake",
  "shield-check",
] as const satisfies readonly ServiceFeatureIconId[];

export function isServiceFeatureIconId(
  value: unknown,
): value is ServiceFeatureIconId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SERVICE_FEATURE_ICONS, value)
  );
}

export function pickServiceFeatureIcon(
  saved: string | undefined,
  fallback: ServiceFeatureIconId,
): ServiceFeatureIconId {
  return isServiceFeatureIconId(saved?.trim())
    ? (saved as ServiceFeatureIconId)
    : fallback;
}

export function resolveServiceFeatureIcon(
  saved: string | undefined,
  fallback: ServiceFeatureIconId,
): LucideIcon {
  return SERVICE_FEATURE_ICONS[pickServiceFeatureIcon(saved, fallback)];
}

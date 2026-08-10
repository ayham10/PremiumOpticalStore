"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Contact,
  Eye,
  Glasses,
  List,
  Menu,
  Percent,
  Phone,
  PlusCircle,
  RefreshCw,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { apiFetch } from "@/lib/admin-api";
import type { AdminSession, DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

const GOLD = "#D4AF37";
const MUTED = "#8B93A0";
const PAGE_BG = "#0B0F14";
const CARD_BG = "#12171E";
const BORDER = "#2A2F36";
const ROW_LINE = "rgba(42,47,54,0.9)";
const INK = "#FFFFFF";

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ar: "ar",
  he: "he",
};

function serviceLabel(t: (key: string) => string, service: string): string {
  const key = `clinicBooking.services.${service}`;
  const label = t(key);
  return label === key ? service : label;
}

function serviceIcon(service: string): LucideIcon {
  const s = (service || "").toLowerCase();
  if (s.includes("contact") || s.includes("عدسات")) return Contact;
  if (s.includes("glass") || s.includes("frame") || s.includes("نظارات")) {
    return Glasses;
  }
  return Eye;
}

/** Split clock + period for stacked mobile / inline desktop display */
function splitTime(time: string, locale: Locale): { clock: string; period: string } {
  if (!time) return { clock: "", period: "" };
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { clock: time, period: "" };
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  if (locale === "ar") return { clock, period: h < 12 ? "صباحاً" : "مساءً" };
  if (locale === "he") return { clock, period: h < 12 ? "בוקר" : "ערב" };
  return { clock, period: h < 12 ? "AM" : "PM" };
}

function formatPhone(phone: string): string {
  const value = (phone || "").trim();
  return value || "—";
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstNameFrom(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return parts[0] || "Ayham";
}

function initialsFromName(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase() || "AH";
}

function openShellMobileNav() {
  window.dispatchEvent(new CustomEvent("admin-open-nav"));
  const btn = document.querySelector(
    "[data-admin-open-nav]",
  ) as HTMLButtonElement | null;
  btn?.click();
}

function GoldIcon({
  icon: Icon,
  size = 23,
  className = "",
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={1.45}
      color={GOLD}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}

function Panel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`admin-home-panel ${className}`}
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        height: "fit-content",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export default function AdminDashboardPage() {
  const { t, locale } = useLocale();
  const { branding } = useBranding();
  const [stats, setStats] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profileInitials, setProfileInitials] = useState("AH");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<
        DashboardPayload | { stats: DashboardPayload }
      >("/api/dashboard");
      const next = "stats" in data ? data.stats : data;
      setStats(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.dashboard.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ user: AdminSession } | AdminSession>(
          "/api/auth/me",
        );
        const user = "user" in data ? data.user : data;
        setProfileName(user.name || "");
        setProfileInitials(initialsFromName(user.name));
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  useEffect(() => {
    function onFocus() {
      void load();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") void load();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  /* Dashboard uses its own chrome — hide shell sticky bar */
  useEffect(() => {
    document.body.classList.add("admin-home-active");
    const bar = document.querySelector(
      ".admin-shell .sticky.top-0",
    ) as HTMLElement | null;
    const prev = bar?.style.display;
    if (bar) bar.style.display = "none";
    return () => {
      document.body.classList.remove("admin-home-active");
      if (bar) bar.style.display = prev || "";
    };
  }, []);

  const bookingsHref = "/admin/eye-exam?tab=appointments";
  const todayHref = useMemo(
    () => `${bookingsHref}&date=${todayIsoLocal()}`,
    [],
  );

  const todayLabel = new Date().toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const firstName = firstNameFrom(profileName);
  const greetingTitle =
    locale === "ar"
      ? `أهلاً ${firstName} 👋`
      : locale === "he"
        ? `שלום ${firstName} 👋`
        : `Hello ${firstName} 👋`;
  const greetingSub =
    locale === "ar"
      ? "مرحباً بك في لوحة التحكم الخاصة بعيون"
      : locale === "he"
        ? "ברוך הבא ללוח הבקרה של עيون"
        : "Welcome to the OYON control panel";

  if (loading && !stats) {
    return (
      <div style={{ background: PAGE_BG, padding: 16, color: MUTED }}>
        {t("common.loading")}
      </div>
    );
  }

  if ((error && !stats) || !stats) {
    return (
      <div style={{ background: PAGE_BG, padding: 16 }}>
        <Panel>
          <p style={{ color: "var(--danger)", margin: 0 }}>
            {error || t("admin.dashboard.loadError")}
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-3 inline-flex items-center gap-2"
            onClick={() => void load()}
          >
            <RefreshCw size={15} strokeWidth={1.5} />
            {t("admin.dashboard.refresh")}
          </button>
        </Panel>
      </div>
    );
  }

  const schedule = stats.todaysSchedule || [];

  const quickActions: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
  }> = [
    {
      href: "/admin/eye-exam?tab=appointments&book=1",
      label: "إضافة موعد",
      icon: PlusCircle,
    },
    {
      href: bookingsHref,
      label: "عرض كل المواعيد",
      icon: List,
    },
    {
      href: "/admin/eye-exam?tab=availability",
      label: "تعديل ساعات العمل للحجز",
      icon: Clock3,
    },
    {
      href: "/admin/settings?tab=hours",
      label: "تعديل أيام العمل",
      icon: CalendarDays,
    },
    {
      href: "/admin/inventory",
      label: "تعديل المنتجات",
      icon: Glasses,
    },
    {
      href: "/admin/promotions",
      label: "تعديل العروض",
      icon: Percent,
    },
  ];

  return (
    <div className="admin-dashboard admin-home mx-auto w-full max-w-[1360px]">
      {/* ── HEADER ── */}
      <header className="admin-home-header relative flex items-center">
        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center"
          style={{ insetInlineStart: 0 }}
        >
          <button
            type="button"
            aria-label={t("nav.menu")}
            onClick={openShellMobileNav}
            className="admin-home-icon-btn grid place-items-center"
            style={{ background: "transparent", border: "none", color: "#F2F4F6" }}
          >
            <Menu size={25} strokeWidth={1.55} />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto scale-[1.05] lg:scale-110">
            <BrandMark branding={branding} href="/admin" size="md" />
          </div>
        </div>

        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5"
          style={{ insetInlineEnd: 0 }}
        >
          <button
            type="button"
            className="flex items-center gap-1.5"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: GOLD,
            }}
            aria-label={profileInitials}
          >
            <span className="admin-home-avatar grid place-items-center rounded-full font-bold">
              {profileInitials}
            </span>
            <ChevronDown
              size={17}
              strokeWidth={1.65}
              className="hidden lg:block"
              color={GOLD}
            />
          </button>
        </div>
      </header>

      {/* ── DATE + GREETING ── */}
      <div className="admin-home-hero-mobile flex flex-col items-center text-center lg:hidden">
        <button
          type="button"
          className="admin-home-date-btn inline-flex w-full items-center justify-center gap-2.5 font-medium"
        >
          <GoldIcon icon={CalendarDays} size={21} />
          <span className="truncate">{todayLabel}</span>
        </button>
        <div className="admin-home-greeting">
          <h1 className="admin-home-greeting-title m-0 font-semibold tracking-[-0.02em]">
            {greetingTitle}
          </h1>
          <p className="admin-home-greeting-sub mb-0 leading-relaxed">
            {greetingSub}
          </p>
        </div>
      </div>

      <div className="admin-home-hero-desktop hidden items-end justify-between lg:flex">
        <div className="min-w-0">
          <h1 className="admin-home-greeting-title m-0 font-semibold tracking-[-0.03em]">
            {greetingTitle}
          </h1>
          <p className="admin-home-greeting-sub mb-0 leading-relaxed">
            {greetingSub}
          </p>
        </div>
        <button
          type="button"
          className="admin-home-date-btn inline-flex shrink-0 items-center gap-2.5 font-medium"
        >
          <GoldIcon icon={CalendarDays} size={21} />
          <span>{todayLabel}</span>
        </button>
      </div>

      {error ? (
        <p
          className="m-0 rounded-[14px] px-3 py-2 text-sm"
          style={{
            border: "1px solid rgba(224,122,122,0.35)",
            background: "rgba(224,122,122,0.12)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      {/* ── TODAY'S BOOKINGS ── */}
      <Panel className="admin-home-bookings">
        <div className="admin-home-section-title flex items-center gap-2.5">
          <GoldIcon icon={CalendarDays} size={23} />
          <h2 className="m-0 font-semibold" style={{ color: INK, lineHeight: 1.35 }}>
            مواعيد اليوم
          </h2>
        </div>

        {schedule.length ? (
          <div>
            <div
              className="admin-home-bookings-head hidden gap-4 font-medium lg:grid"
              style={{ color: MUTED }}
            >
              <span>وقت</span>
              <span>العميل</span>
              <span>رقم الهاتف</span>
              <span>سبب الموعد</span>
            </div>

            <ul className="m-0 list-none p-0">
              {schedule.map((a, idx) => {
                const ReasonIcon = serviceIcon(a.service);
                const { clock, period } = splitTime(a.startTime, locale);
                return (
                  <li key={a.id}>
                    <Link
                      href={todayHref}
                      className="block no-underline"
                      style={{
                        borderTop: idx === 0 ? `1px solid ${ROW_LINE}` : undefined,
                        borderBottom: `1px solid ${ROW_LINE}`,
                      }}
                    >
                      {/* Desktop row */}
                      <div className="admin-home-booking-row-desktop hidden items-center gap-4 lg:grid">
                        <div className="min-w-0">
                          <p
                            className="m-0 text-[1rem] font-bold tabular-nums leading-tight"
                            style={{ color: GOLD }}
                          >
                            {clock}
                          </p>
                          <p
                            className="mb-0 mt-0.5 text-[0.78rem] font-medium leading-tight"
                            style={{ color: GOLD }}
                          >
                            {period}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <GoldIcon icon={User} size={20} />
                          <p
                            className="m-0 truncate text-[0.95rem] font-semibold"
                            style={{ color: INK }}
                          >
                            {a.customerName}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <GoldIcon icon={Phone} size={20} />
                          <p
                            className="m-0 truncate text-[0.9rem] tabular-nums"
                            style={{ color: MUTED }}
                            dir="ltr"
                          >
                            {formatPhone(a.customerPhone)}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <GoldIcon icon={ReasonIcon} size={20} />
                          <p
                            className="m-0 truncate text-[0.9rem] font-medium"
                            style={{ color: "#E8EAED" }}
                          >
                            {serviceLabel(t, a.service)}
                          </p>
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="admin-home-booking-row-mobile flex items-center gap-3.5 lg:hidden">
                        <div className="admin-home-booking-time shrink-0 text-start">
                          <p
                            className="m-0 text-[0.95rem] font-bold tabular-nums leading-tight"
                            style={{ color: GOLD }}
                          >
                            {clock}
                          </p>
                          <p
                            className="mb-0 mt-0.5 text-[0.72rem] font-medium leading-tight"
                            style={{ color: GOLD }}
                          >
                            {period}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <GoldIcon icon={User} size={18} />
                            <p
                              className="m-0 truncate text-[0.92rem] font-semibold"
                              style={{ color: INK }}
                            >
                              {a.customerName}
                            </p>
                          </div>
                          <div className="mt-1.5 flex min-w-0 items-center gap-2">
                            <GoldIcon icon={Phone} size={17} />
                            <p
                              className="m-0 truncate text-[0.8rem] tabular-nums"
                              style={{ color: MUTED }}
                              dir="ltr"
                            >
                              {formatPhone(a.customerPhone)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div
            className="mt-1 rounded-[14px] px-3.5 py-4"
            style={{ border: `1px dashed ${BORDER}`, background: PAGE_BG }}
          >
            <p className="m-0 text-[0.92rem] font-semibold" style={{ color: INK }}>
              {t("admin.dashboard.emptyToday")}
            </p>
            <p
              className="mb-0 mt-1 text-[0.8rem] leading-relaxed"
              style={{ color: MUTED }}
            >
              {t("admin.dashboard.emptyTodayLead")}
            </p>
          </div>
        )}
      </Panel>

      {/* ── QUICK SERVICES ── */}
      <Panel className="admin-home-services">
        <div className="admin-home-services-title flex items-center gap-2.5">
          <GoldIcon icon={Zap} size={23} />
          <h2 className="m-0 font-semibold" style={{ color: INK, lineHeight: 1.35 }}>
            خدمات سريعة
          </h2>
        </div>

        <div className="admin-home-services-grid grid grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="admin-home-service-btn flex h-full flex-col items-center justify-center text-center no-underline transition hover:border-[rgba(212,175,55,0.45)] hover:bg-[rgba(212,175,55,0.05)] active:scale-[0.99]"
              style={{
                background: PAGE_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <GoldIcon icon={action.icon} size={30} />
              <span
                className="admin-home-service-label font-semibold leading-snug"
                style={{ color: INK }}
              >
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

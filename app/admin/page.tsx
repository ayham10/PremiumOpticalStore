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
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock3,
  Contact,
  Eye,
  Glasses,
  List,
  Menu,
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

const GOLD = "#D4AF6A";
const MUTED = "#8A929C";
const PAGE_BG = "#0B0F14";
const CARD_BG = "#12171E";
const BORDER = "#2A2F36";
const ROW_LINE = "rgba(42,47,54,0.95)";

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

/** e.g. 09:00 صباحاً / 16:00 مساءً */
function formatTimeRich(time: string, locale: Locale): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const clock = `${hh}:${mm}`;
  if (locale === "ar") {
    return h < 12 ? `${clock} صباحاً` : `${clock} مساءً`;
  }
  if (locale === "he") {
    return h < 12 ? `${clock} בוקר` : `${clock} ערב`;
  }
  return h < 12 ? `${clock} AM` : `${clock} PM`;
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
  size = 18,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  return <Icon size={size} strokeWidth={1.5} color={GOLD} />;
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
      className={className}
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 16,
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
  const notifCount = schedule.length;

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
      href: "/admin/calendar",
      label: "تعديل التواريخ",
      icon: CalendarRange,
    },
    {
      href: "/admin/eye-exam?tab=availability",
      label: "تعديل ساعات العمل",
      icon: Clock3,
    },
    {
      href: "/admin/settings",
      label: "تعديل أوقات الدوام",
      icon: CalendarClock,
    },
    {
      href: "/admin/inventory",
      label: "تعديل المنتجات",
      icon: Glasses,
    },
    {
      href: bookingsHref,
      label: "عرض كل المواعيد",
      icon: List,
    },
  ];

  return (
    <div
      className="admin-dashboard mx-auto w-full max-w-[1120px] pb-[calc(5.85rem+env(safe-area-inset-bottom,0px))]"
      style={{
        marginTop: "-1.15rem",
        marginInline: "auto",
        marginBottom: "calc(-1.5rem - env(safe-area-inset-bottom, 0px))",
        minHeight: "100%",
        background: PAGE_BG,
        paddingInline: 16,
        paddingTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* ── HEADER (same structure both breakpoints; spacing differs) ── */}
      <header className="relative flex h-12 items-center lg:h-14">
        {/* Start: hamburger (+ bell on desktop) */}
        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5"
          style={{ insetInlineStart: 0 }}
        >
          <button
            type="button"
            aria-label={t("nav.menu")}
            onClick={openShellMobileNav}
            className="grid place-items-center"
            style={{
              width: 40,
              height: 40,
              background: "transparent",
              border: "none",
              color: GOLD,
            }}
          >
            <Menu size={22} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="الإشعارات"
            className="relative hidden place-items-center lg:grid"
            style={{
              width: 40,
              height: 40,
              background: "transparent",
              border: "none",
              color: GOLD,
            }}
          >
            <Bell size={20} strokeWidth={1.55} />
            {notifCount > 0 ? (
              <span
                className="absolute grid place-items-center rounded-full text-[0.62rem] font-bold"
                style={{
                  top: 4,
                  insetInlineEnd: 4,
                  minWidth: 16,
                  height: 16,
                  paddingInline: 3,
                  background: GOLD,
                  color: "#1A1408",
                  lineHeight: 1,
                }}
              >
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Center logo */}
        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            <BrandMark branding={branding} href="/admin" size="md" />
          </div>
        </div>

        {/* End: bell (mobile) + profile */}
        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2"
          style={{ insetInlineEnd: 0 }}
        >
          <button
            type="button"
            aria-label="الإشعارات"
            className="relative grid place-items-center lg:hidden"
            style={{
              width: 40,
              height: 40,
              background: "transparent",
              border: "none",
              color: GOLD,
            }}
          >
            <Bell size={19} strokeWidth={1.55} />
            {notifCount > 0 ? (
              <span
                className="absolute grid place-items-center rounded-full text-[0.58rem] font-bold"
                style={{
                  top: 5,
                  insetInlineEnd: 5,
                  minWidth: 15,
                  height: 15,
                  paddingInline: 3,
                  background: GOLD,
                  color: "#1A1408",
                  lineHeight: 1,
                }}
              >
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            ) : null}
          </button>

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
            <span
              className="grid place-items-center rounded-full text-[0.72rem] font-bold"
              style={{
                width: 36,
                height: 36,
                background: "rgba(212,175,106,0.12)",
                border: "1px solid rgba(212,175,106,0.55)",
                color: GOLD,
              }}
            >
              {profileInitials}
            </span>
            <ChevronDown
              size={14}
              strokeWidth={1.7}
              className="hidden lg:block"
              color={GOLD}
            />
          </button>
        </div>
      </header>

      {/* ── DATE + GREETING ── */}
      {/* Mobile: stacked & centered */}
      <div className="flex flex-col items-center gap-3 text-center lg:hidden">
        <button
          type="button"
          className="inline-flex h-11 w-full max-w-[22rem] items-center justify-center gap-2 rounded-[14px] px-4 text-[0.84rem] font-medium"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            color: "#E8EAED",
          }}
        >
          <GoldIcon icon={CalendarDays} size={16} />
          <span className="truncate">{todayLabel}</span>
          <ChevronDown size={14} strokeWidth={1.6} color={GOLD} />
        </button>
        <div>
          <h1
            className="m-0 text-[1.55rem] font-semibold tracking-[-0.02em]"
            style={{ color: "#F5F6F7", lineHeight: 1.35 }}
          >
            {greetingTitle}
          </h1>
          <p
            className="mb-0 mt-1 text-[0.82rem] leading-relaxed"
            style={{ color: MUTED }}
          >
            {greetingSub}
          </p>
        </div>
      </div>

      {/* Desktop: greeting on visual right (RTL start), date on visual left */}
      <div className="hidden items-end justify-between gap-6 lg:flex">
        <div className="min-w-0">
          <h1
            className="m-0 text-[1.85rem] font-semibold tracking-[-0.03em]"
            style={{ color: "#F5F6F7", lineHeight: 1.3 }}
          >
            {greetingTitle}
          </h1>
          <p
            className="mb-0 mt-1.5 text-[0.9rem] leading-relaxed"
            style={{ color: MUTED }}
          >
            {greetingSub}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] px-4 text-[0.88rem] font-medium"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            color: "#E8EAED",
          }}
        >
          <GoldIcon icon={CalendarDays} size={16} />
          <span>{todayLabel}</span>
          <ChevronDown size={14} strokeWidth={1.6} color={GOLD} />
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
      <Panel style={{ padding: "14px 16px 10px" }}>
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <GoldIcon icon={CalendarDays} size={18} />
          <h2
            className="m-0 text-[1.02rem] font-semibold"
            style={{ color: "#F5F6F7", lineHeight: 1.35 }}
          >
            مواعيد اليوم
          </h2>
        </div>

        {schedule.length ? (
          <div>
            {/* Desktop headers */}
            <div
              className="hidden grid-cols-[7.5rem_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] gap-3 px-2 pb-2 pt-1 text-[0.72rem] font-medium lg:grid"
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
                      <div className="hidden grid-cols-[7.5rem_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] items-center gap-3 px-2 py-3.5 lg:grid">
                        <p
                          className="m-0 whitespace-nowrap text-[0.92rem] font-bold tabular-nums"
                          style={{ color: GOLD }}
                        >
                          {formatTimeRich(a.startTime, locale)}
                        </p>
                        <div className="flex min-w-0 items-center gap-2">
                          <GoldIcon icon={User} size={15} />
                          <p
                            className="m-0 truncate text-[0.9rem] font-semibold"
                            style={{ color: "#F3F4F5" }}
                          >
                            {a.customerName}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <GoldIcon icon={Phone} size={15} />
                          <p
                            className="m-0 truncate text-[0.86rem] tabular-nums"
                            style={{ color: "#E8EAED" }}
                            dir="ltr"
                          >
                            {formatPhone(a.customerPhone)}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <GoldIcon icon={ReasonIcon} size={15} />
                          <p
                            className="m-0 truncate text-[0.86rem] font-medium"
                            style={{ color: "#E8EAED" }}
                          >
                            {serviceLabel(t, a.service)}
                          </p>
                        </div>
                      </div>

                      {/* Mobile row: time | name+phone stacked */}
                      <div className="flex items-center gap-3 px-1 py-3.5 lg:hidden">
                        <p
                          className="m-0 w-[5.75rem] shrink-0 whitespace-nowrap text-[0.88rem] font-bold tabular-nums"
                          style={{ color: GOLD }}
                        >
                          {formatTimeRich(a.startTime, locale)}
                        </p>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <GoldIcon icon={User} size={14} />
                            <p
                              className="m-0 truncate text-[0.88rem] font-semibold"
                              style={{ color: "#F3F4F5" }}
                            >
                              {a.customerName}
                            </p>
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1.5">
                            <GoldIcon icon={Phone} size={13} />
                            <p
                              className="m-0 truncate text-[0.78rem] tabular-nums"
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
            className="mt-1 rounded-[12px] px-3 py-3.5"
            style={{ border: `1px dashed ${BORDER}`, background: PAGE_BG }}
          >
            <p
              className="m-0 text-[0.88rem] font-semibold"
              style={{ color: "#F0F1F2" }}
            >
              {t("admin.dashboard.emptyToday")}
            </p>
            <p
              className="mb-0 mt-1 text-[0.78rem] leading-relaxed"
              style={{ color: MUTED }}
            >
              {t("admin.dashboard.emptyTodayLead")}
            </p>
          </div>
        )}
      </Panel>

      {/* ── QUICK SERVICES ── */}
      <Panel style={{ padding: 16 }}>
        <div className="mb-4 flex items-center gap-2.5 px-0.5">
          <GoldIcon icon={Zap} size={18} />
          <h2
            className="m-0 text-[1.02rem] font-semibold"
            style={{ color: "#F5F6F7", lineHeight: 1.35 }}
          >
            خدمات سريعة
          </h2>
        </div>

        {/* Mobile: 2 cols × 3 rows | Desktop: 3 cols × 2 rows */}
        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-3 lg:gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex flex-col items-center justify-center gap-2.5 rounded-[16px] px-3 py-5 text-center no-underline transition hover:border-[rgba(212,175,106,0.45)] hover:bg-[rgba(212,175,106,0.05)] active:scale-[0.99] lg:py-6"
              style={{
                background: PAGE_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <GoldIcon icon={action.icon} size={22} />
              <span
                className="text-[0.84rem] font-semibold leading-snug lg:text-[0.9rem]"
                style={{ color: "#F3F4F5" }}
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

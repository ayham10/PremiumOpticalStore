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
  Clock3,
  Glasses,
  Lightbulb,
  List,
  Menu,
  Plus,
  RefreshCw,
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
const PAGE_BG = "#0E1116";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ar: "ar",
  he: "he",
};

const TIPS_AR = [
  "راجع مواعيد اليوم في الصباح ورتّب أولوية الحالات الطارئة قبل فتح العيادة.",
  "تأكد من جاهزية غرفة الفحص والعدسات التجريبية قبل أول موعد.",
  "حدّث ساعات العمل والاستثناءات مبكراً لتجنب تعارض الحجوزات.",
  "تابع مخزون الإطارات الأكثر طلباً قبل نهاية الأسبوع.",
  "أرسل تذكيراً ودياً للعملاء ذوي المواعيد المسائية لتقليل الغياب.",
  "راجع ملاحظات الحجوزات قبل استقبال كل عميل لتقديم خدمة أدق.",
  "حافظ على توازن الجدول بين فحوصات النظر واستشارات الإطارات.",
];

function serviceLabel(t: (key: string) => string, service: string): string {
  const key = `clinicBooking.services.${service}`;
  const label = t(key);
  return label === key ? service : label;
}

function formatTime(time: string, locale: Locale): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(LOCALE_TAGS[locale], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function greetingFor(locale: Locale): string {
  const hour = new Date().getHours();
  if (locale === "ar") {
    if (hour < 12) return "صباح الخير";
    return "مساء الخير";
  }
  if (locale === "he") {
    if (hour < 12) return "בוקר טוב";
    return "ערב טוב";
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function tipOfTheDay(locale: Locale): string {
  const idx = Math.floor(Date.now() / 86_400_000) % TIPS_AR.length;
  if (locale === "ar") return TIPS_AR[idx];
  if (locale === "he") {
    return "בדקו את יומן היום בבוקר וסדרו את הבדיקות הדחופות לפני פתיחת המרפאה.";
  }
  return "Review today's schedule each morning and prioritize urgent cases before opening.";
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
    ".admin-shell .sticky.top-0 button[aria-expanded], [data-admin-open-nav]",
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
  return <Icon size={size} strokeWidth={1.55} color={GOLD} />;
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
        borderRadius: 16,
        padding: 14,
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
  const [refreshing, setRefreshing] = useState(false);
  const [profileInitials, setProfileInitials] = useState("AH");

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
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
        setProfileInitials(initialsFromName(user.name));
      } catch {
        /* keep AH */
      }
    })();
  }, []);

  useEffect(() => {
    function onFocus() {
      void load({ soft: true });
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void load({ soft: true });
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const bar = document.querySelector(
      ".admin-shell .sticky.top-0.md\\:hidden, .admin-shell .sticky.top-0",
    ) as HTMLElement | null;
    if (!bar || window.matchMedia("(min-width: 768px)").matches) return;
    const prev = bar.style.display;
    bar.style.display = "none";
    return () => {
      bar.style.display = prev;
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
  });

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
            <RefreshCw size={15} strokeWidth={1.55} />
            {t("admin.dashboard.refresh")}
          </button>
        </Panel>
      </div>
    );
  }

  const schedule = stats.todaysSchedule || [];
  const tip = tipOfTheDay(locale);

  const quickActions: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
  }> = [
    {
      href: "/admin/eye-exam?tab=appointments&book=1",
      label: "إضافة موعد",
      icon: Plus,
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
      className="admin-dashboard mx-auto w-full max-w-[1440px] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-2"
      style={{
        marginTop: "-1.15rem",
        marginInline: "auto",
        marginBottom: "calc(-1.5rem - env(safe-area-inset-bottom, 0px))",
        minHeight: "100%",
        background: PAGE_BG,
        paddingInline: 16,
        paddingTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* MOBILE HEADER — hamburger | centered logo | bell + profile */}
      <header className="relative flex h-11 items-center md:hidden">
        <button
          type="button"
          aria-label={t("nav.menu")}
          onClick={openShellMobileNav}
          className="absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-[11px]"
          style={{
            insetInlineStart: 0,
            width: 40,
            height: 40,
            border: `1px solid ${BORDER}`,
            background: CARD_BG,
            color: "#E8EAED",
          }}
        >
          <Menu size={17} strokeWidth={1.55} />
        </button>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            <BrandMark branding={branding} href="/admin" size="sm" />
          </div>
        </div>

        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2"
          style={{ insetInlineEnd: 0 }}
        >
          <button
            type="button"
            aria-label="الإشعارات"
            className="grid place-items-center rounded-[11px]"
            style={{
              width: 40,
              height: 40,
              border: "1px solid rgba(212,175,106,0.45)",
              background: "rgba(212,175,106,0.06)",
              color: GOLD,
            }}
          >
            <Bell size={16} strokeWidth={1.55} />
          </button>
          <div
            className="grid place-items-center rounded-full text-[0.72rem] font-bold"
            style={{
              width: 36,
              height: 36,
              background: "rgba(212,175,106,0.12)",
              border: "1px solid rgba(212,175,106,0.4)",
              color: GOLD,
            }}
            aria-label={profileInitials}
          >
            {profileInitials}
          </div>
        </div>
      </header>

      {/* DESKTOP HEADER */}
      <header className="hidden items-center justify-between gap-4 md:flex md:pt-1">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark branding={branding} href="/admin" size="md" />
          <div className="min-w-0">
            <p
              className="mb-0.5 mt-0 text-[0.8rem] font-medium"
              style={{ color: MUTED }}
            >
              {greetingFor(locale)}
            </p>
            <h1
              className="m-0 text-[1.65rem] font-semibold tracking-[-0.03em]"
              style={{ color: "#F5F6F7", lineHeight: 1.3 }}
            >
              {t("admin.dashboard.title")}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div
            className="inline-flex h-10 items-center gap-2 rounded-[12px] px-3 text-[0.82rem] font-medium"
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              color: "#E8EAED",
            }}
          >
            <GoldIcon icon={CalendarDays} size={15} />
            <span className="max-w-[16rem] truncate">{todayLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => void load({ soft: true })}
            disabled={refreshing}
            aria-label={t("admin.dashboard.refresh")}
            className="grid place-items-center rounded-[11px]"
            style={{
              width: 40,
              height: 40,
              border: `1px solid ${BORDER}`,
              background: CARD_BG,
              color: MUTED,
            }}
          >
            <RefreshCw
              size={15}
              strokeWidth={1.55}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
          <button
            type="button"
            aria-label="الإشعارات"
            className="grid place-items-center rounded-[11px]"
            style={{
              width: 40,
              height: 40,
              border: "1px solid rgba(212,175,106,0.45)",
              background: "rgba(212,175,106,0.06)",
              color: GOLD,
            }}
          >
            <Bell size={16} strokeWidth={1.55} />
          </button>
          <div
            className="grid place-items-center rounded-full text-[0.72rem] font-bold"
            style={{
              width: 38,
              height: 38,
              background: "rgba(212,175,106,0.12)",
              border: "1px solid rgba(212,175,106,0.4)",
              color: GOLD,
            }}
          >
            {profileInitials}
          </div>
        </div>
      </header>

      {/* MOBILE date then RTL greeting */}
      <div className="space-y-2 md:hidden">
        <div
          className="inline-flex h-9 max-w-full items-center gap-2 rounded-[12px] px-3 text-[0.78rem] font-medium"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            color: "#E8EAED",
          }}
        >
          <GoldIcon icon={CalendarDays} size={14} />
          <span className="truncate">{todayLabel}</span>
        </div>
        <div>
          <p
            className="mb-0.5 mt-0 text-[0.78rem] font-medium"
            style={{ color: MUTED }}
          >
            {greetingFor(locale)}
          </p>
          <h1
            className="m-0 text-[1.35rem] font-semibold tracking-[-0.03em]"
            style={{ color: "#F5F6F7", lineHeight: 1.35 }}
          >
            {t("admin.dashboard.title")}
          </h1>
        </div>
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

      {/* Main sections — stacked on mobile/tablet, side-by-side on desktop */}
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start xl:gap-5">
        {/* مواعيد اليوم */}
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <GoldIcon icon={CalendarDays} size={18} />
              <h2
                className="m-0 text-[0.98rem] font-semibold"
                style={{ color: "#F5F6F7", lineHeight: 1.4 }}
              >
                مواعيد اليوم
              </h2>
            </div>
            <Link
              href={bookingsHref}
              className="shrink-0 text-[0.76rem] font-semibold no-underline"
              style={{ color: GOLD }}
            >
              عرض كل المواعيد
            </Link>
          </div>

          {schedule.length ? (
            <div className="flex flex-col gap-2.5">
              {/* Desktop column headers */}
              <div
                className="hidden grid-cols-[4.75rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3.5 text-[0.7rem] font-medium xl:grid"
                style={{ color: MUTED }}
              >
                <span>وقت</span>
                <span>العميل</span>
                <span>الهاتف</span>
                <span>سبب الموعد</span>
              </div>

              {schedule.map((a) => (
                <Link
                  key={a.id}
                  href={todayHref}
                  className="block no-underline transition hover:border-[rgba(212,175,106,0.35)]"
                >
                  {/* Desktop row — time | customer | phone | reason */}
                  <div
                    className="hidden grid-cols-[4.75rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 px-3.5 py-3 xl:grid"
                    style={{
                      background: PAGE_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                    }}
                  >
                    <p
                      className="m-0 text-[0.88rem] font-bold tabular-nums"
                      style={{ color: GOLD }}
                    >
                      {formatTime(a.startTime, locale)}
                    </p>
                    <p
                      className="m-0 truncate text-[0.88rem] font-semibold"
                      style={{ color: "#F3F4F5" }}
                    >
                      {a.customerName}
                    </p>
                    <p
                      className="m-0 truncate text-[0.82rem] tabular-nums"
                      style={{ color: MUTED }}
                      dir="ltr"
                    >
                      {formatPhone(a.customerPhone)}
                    </p>
                    <p
                      className="m-0 truncate text-[0.82rem] font-medium"
                      style={{ color: "#E8EAED" }}
                    >
                      {serviceLabel(t, a.service)}
                    </p>
                  </div>

                  {/* Mobile/tablet — time | name | phone only */}
                  <div
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 xl:hidden"
                    style={{
                      background: PAGE_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                    }}
                  >
                    <p
                      className="m-0 whitespace-nowrap text-[0.82rem] font-bold tabular-nums"
                      style={{ color: GOLD, minWidth: "3.4rem" }}
                    >
                      {formatTime(a.startTime, locale)}
                    </p>
                    <p
                      className="m-0 min-w-0 truncate text-[0.84rem] font-semibold"
                      style={{ color: "#F3F4F5" }}
                    >
                      {a.customerName}
                    </p>
                    <p
                      className="m-0 max-w-[7.5rem] truncate text-[0.72rem] tabular-nums sm:max-w-[9rem]"
                      style={{ color: MUTED }}
                      dir="ltr"
                    >
                      {formatPhone(a.customerPhone)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="rounded-[12px] px-3 py-3.5"
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

        {/* خدمات سريعة */}
        <Panel>
          <div className="mb-3.5 flex items-center gap-2">
            <GoldIcon icon={Zap} size={18} />
            <h2
              className="m-0 text-[0.98rem] font-semibold"
              style={{ color: "#F5F6F7", lineHeight: 1.4 }}
            >
              خدمات سريعة
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="flex h-full flex-col justify-between gap-3 rounded-[14px] px-3 py-3.5 no-underline transition hover:border-[rgba(212,175,106,0.45)] hover:bg-[rgba(212,175,106,0.06)] active:scale-[0.99]"
                style={{
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <span
                  className="grid place-items-center rounded-[10px]"
                  style={{
                    width: 32,
                    height: 32,
                    background: "rgba(212,175,106,0.08)",
                    border: "1px solid rgba(212,175,106,0.3)",
                  }}
                >
                  <GoldIcon icon={action.icon} size={15} />
                </span>
                <span
                  className="text-[0.82rem] font-semibold leading-snug"
                  style={{ color: "#F3F4F5" }}
                >
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* نصيحة اليوم — compact */}
      <Panel style={{ padding: "11px 14px" }}>
        <div className="flex items-start gap-3">
          <span
            className="grid shrink-0 place-items-center rounded-[10px]"
            style={{
              width: 32,
              height: 32,
              background: "rgba(212,175,106,0.08)",
              border: "1px solid rgba(212,175,106,0.3)",
            }}
          >
            <GoldIcon icon={Lightbulb} size={15} />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 text-[0.86rem] font-semibold"
              style={{ color: GOLD, lineHeight: 1.35 }}
            >
              نصيحة اليوم
            </h2>
            <p
              className="mb-0 mt-1 text-[0.8rem] leading-relaxed"
              style={{ color: "#E8EAED" }}
            >
              {tip}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

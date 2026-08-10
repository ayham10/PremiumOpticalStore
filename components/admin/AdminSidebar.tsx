"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarClock,
  Package,
  Tag,
  ImageIcon,
  Settings,
  LogOut,
  Menu,
  MoreHorizontal,
  Home,
  Glasses,
  UserRound,
  X,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/admin-permissions";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/format";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import AccountSettingsModal from "@/components/admin/AccountSettingsModal";

const GOLD = "#D4AF37";
const BORDER = "#2A2F36";
const CARD_BG = "#151A21";
const RAIL_W = 88;

const NAV: Array<{
  href: string;
  labelKey: string;
  permission: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  match?: (pathname: string, tab: string | null) => boolean;
}> = [
  {
    href: "/admin",
    labelKey: "admin.sidebar.dashboard",
    permission: "dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/eye-exam?tab=appointments",
    labelKey: "admin.sidebar.appointments",
    permission: "appointments",
    icon: CalendarDays,
    match: (pathname, tab) =>
      pathname.startsWith("/admin/eye-exam") && tab === "appointments",
  },
  {
    href: "/admin/eye-exam?tab=availability",
    labelKey: "admin.sidebar.availability",
    permission: "appointments",
    icon: CalendarClock,
    match: (pathname, tab) =>
      pathname.startsWith("/admin/eye-exam") && tab !== "appointments",
  },
  {
    href: "/admin/inventory",
    labelKey: "admin.sidebar.products",
    permission: "inventory",
    icon: Package,
  },
  {
    href: "/admin/media",
    labelKey: "admin.sidebar.media",
    permission: "media",
    icon: ImageIcon,
  },
  {
    href: "/admin/promotions",
    labelKey: "admin.sidebar.promotions",
    permission: "promotions",
    icon: Tag,
  },
  {
    href: "/admin/settings",
    labelKey: "admin.sidebar.settings",
    permission: "settings",
    icon: Settings,
  },
];

const BOTTOM_NAV = [
  {
    href: "/admin",
    label: "الرئيسية",
    icon: Home,
    match: (pathname: string) => pathname === "/admin",
  },
  {
    href: "/admin/eye-exam?tab=appointments",
    label: "المواعيد",
    icon: CalendarDays,
    match: (pathname: string, tab: string | null) =>
      pathname.startsWith("/admin/eye-exam") && tab === "appointments",
  },
  {
    href: "/admin/inventory",
    label: "المنتجات",
    icon: Glasses,
    match: (pathname: string) => pathname.startsWith("/admin/inventory"),
  },
  {
    href: "/admin/eye-exam?tab=availability",
    label: "ساعات العمل",
    icon: CalendarClock,
    match: (pathname: string, tab: string | null) =>
      pathname.startsWith("/admin/eye-exam") && tab !== "appointments",
  },
] as const;

function SidebarNav({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();
  const { branding } = useBranding();
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const tab = searchParams.get("tab");

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* continue */
    }
    router.replace("/admin/login");
  }

  const links = NAV.filter((item) => hasPermission(role, item.permission));

  return (
    <aside className="admin-sidebar flex h-full min-h-full flex-col border-e border-[var(--line)] bg-[var(--admin-card,#131A22)]">
      <div className="admin-sidebar-brand border-b border-[var(--line)] px-5 py-6">
        <BrandMark branding={branding} href="/admin" size="md" />
        <p className="admin-sidebar-admin-label">{t("admin.sidebar.adminLabel")}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {links.map((item) => {
          const active = item.match
            ? item.match(pathname, tab)
            : item.exact
              ? pathname === item.href
              : pathname === item.href.split("?")[0] ||
                pathname.startsWith(`${item.href.split("?")[0]}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn("admin-nav-link", active && "is-active")}
            >
              <Icon size={18} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <div className="px-1 py-1">
          <LanguageSwitcher tone="dark" />
        </div>
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="admin-nav-link w-full"
        >
          <UserRound size={18} />
          {t("admin.sidebar.account")}
        </button>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="admin-nav-link w-full text-[var(--danger)] hover:bg-[rgba(224,122,122,0.12)]"
        >
          <LogOut size={18} />
          {t("admin.logout")}
        </button>
      </div>

      <AccountSettingsModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </aside>
  );
}

function MobileBottomNav({
  onMore,
  moreOpen,
}: {
  onMore: () => void;
  moreOpen: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{
        background: "rgba(11,15,20,0.97)",
        borderColor: BORDER,
        paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0px))",
        backdropFilter: "blur(14px)",
      }}
      aria-label="التنقل السفلي"
    >
      <div className="mx-auto grid max-w-[430px] grid-cols-5 px-1.5 pt-1.5 pb-1">
        {BOTTOM_NAV.map((item) => {
          const active = !moreOpen && item.match(pathname, tab);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-1.5 no-underline"
              style={{ minHeight: 54 }}
            >
              <span
                className="grid place-items-center rounded-full"
                style={
                  active
                    ? {
                        width: 36,
                        height: 36,
                        background:
                          "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 55%, transparent 70%)",
                      }
                    : undefined
                }
              >
                <Icon
                  size={22}
                  strokeWidth={1.45}
                  color={active ? GOLD : "#C8CDD4"}
                />
              </span>
              <span
                className="text-[0.64rem] font-semibold leading-none"
                style={{ color: active ? GOLD : "#C8CDD4" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-1"
          style={{
            minHeight: 52,
            background: "transparent",
            border: "none",
            padding: 0,
          }}
        >
          <MoreHorizontal
            size={22}
            strokeWidth={1.45}
            color={moreOpen ? GOLD : "#C8CDD4"}
          />
          <span
            className="text-[0.64rem] font-semibold leading-none"
            style={{ color: moreOpen ? GOLD : "#C8CDD4" }}
          >
            المزيد
          </span>
        </button>
      </div>
    </nav>
  );
}

/** Desktop-only vertical rail — physical RIGHT side (dashboard home) */
function DashboardDesktopRail({
  onMore,
  moreOpen,
}: {
  onMore: () => void;
  moreOpen: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav
      className="admin-home-desktop-rail fixed top-0 bottom-0 z-40 hidden border-s md:flex md:flex-col"
      style={{
        right: 0,
        width: RAIL_W,
        background: "rgba(11,15,20,0.97)",
        borderColor: BORDER,
        backdropFilter: "blur(14px)",
        paddingTop: 18,
        paddingBottom: 18,
      }}
      aria-label="التنقل الجانبي"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-1">
        {BOTTOM_NAV.map((item) => {
          const active = !moreOpen && item.match(pathname, tab);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[14px] px-1 py-2.5 no-underline"
              style={
                active
                  ? {
                      background:
                        "radial-gradient(circle at 50% 35%, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.06) 55%, transparent 75%)",
                    }
                  : undefined
              }
            >
              <Icon
                size={22}
                strokeWidth={1.45}
                color={active ? GOLD : "#C8CDD4"}
              />
              <span
                className="text-center text-[0.58rem] font-semibold leading-tight"
                style={{ color: active ? GOLD : "#C8CDD4" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[14px] px-1 py-2.5"
          style={{
            background: moreOpen
              ? "radial-gradient(circle at 50% 35%, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.06) 55%, transparent 75%)"
              : "transparent",
            border: "none",
            paddingInline: 4,
          }}
        >
          <MoreHorizontal
            size={22}
            strokeWidth={1.45}
            color={moreOpen ? GOLD : "#C8CDD4"}
          />
          <span
            className="text-center text-[0.58rem] font-semibold leading-tight"
            style={{ color: moreOpen ? GOLD : "#C8CDD4" }}
          >
            المزيد
          </span>
        </button>
      </div>
    </nav>
  );
}

export default function AdminSidebar({
  role,
}: {
  role: UserRole;
  userName?: string;
}) {
  return (
    <Suspense fallback={null}>
      <AdminSidebarInner role={role} />
    </Suspense>
  );
}

function AdminSidebarInner({
  role,
}: {
  role: UserRole;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const { branding } = useBranding();
  const [open, setOpen] = useState(false);
  const tab = searchParams.get("tab");
  const isDashboard = pathname === "/admin";
  const isAppointments =
    pathname.startsWith("/admin/eye-exam") && tab === "appointments";
  const useRailChrome = isDashboard || isAppointments;

  useEffect(() => {
    setOpen(false);
  }, [pathname, tab]);

  useEffect(() => {
    document.body.classList.toggle("has-mobile-nav-open", open);
    return () => document.body.classList.remove("has-mobile-nav-open");
  }, [open]);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("admin-open-nav", onOpen);
    return () => window.removeEventListener("admin-open-nav", onOpen);
  }, []);

  return (
    <div className={cn("relative z-40", useRailChrome ? "" : "md:contents")}>
      {!useRailChrome ? (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(11,15,20,0.92)] px-4 py-3 backdrop-blur md:hidden">
          <BrandMark branding={branding} href="/admin" size="sm" />
          <button
            type="button"
            data-admin-open-nav
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--ink)]"
            onClick={() => setOpen(true)}
            aria-label={t("nav.menu")}
            aria-expanded={open}
          >
            <Menu size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-admin-open-nav
          className="sr-only"
          onClick={() => setOpen(true)}
          aria-label={t("nav.menu")}
          aria-expanded={open}
        />
      )}

      {!useRailChrome ? (
        <div className="hidden h-full md:block">
          <Suspense fallback={null}>
            <SidebarNav role={role} />
          </Suspense>
        </div>
      ) : null}

      <Suspense fallback={null}>
        <MobileBottomNav onMore={() => setOpen(true)} moreOpen={open} />
      </Suspense>

      {useRailChrome ? (
        <Suspense fallback={null}>
          <DashboardDesktopRail
            onMore={() => setOpen(true)}
            moreOpen={open}
          />
        </Suspense>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div
            className="relative h-full w-[min(300px,86vw)] shadow-2xl animate-[fadeIn_0.2s_ease]"
            style={{ background: CARD_BG }}
          >
            <button
              type="button"
              className="absolute end-3 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--admin-card,#131A22)] text-[var(--ink)]"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
            <Suspense fallback={null}>
              <SidebarNav role={role} onNavigate={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </div>
  );
}

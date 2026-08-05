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
          onClick={logout}
          disabled={loggingOut}
          className="admin-nav-link w-full text-[var(--danger)] hover:bg-[rgba(224,122,122,0.12)]"
        >
          <LogOut size={18} />
          {t("admin.logout")}
        </button>
      </div>
    </aside>
  );
}

export default function AdminSidebar({
  role,
}: {
  role: UserRole;
  userName?: string;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { branding } = useBranding();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("has-mobile-nav-open", open);
    return () => document.body.classList.remove("has-mobile-nav-open");
  }, [open]);

  return (
    <div className="relative z-40 md:contents">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(11,15,20,0.92)] px-4 py-3 backdrop-blur md:hidden">
        <BrandMark branding={branding} href="/admin" size="sm" />
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--ink)]"
          onClick={() => setOpen(true)}
          aria-label={t("nav.menu")}
          aria-expanded={open}
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="hidden h-full md:block">
        <Suspense fallback={null}>
          <SidebarNav role={role} />
        </Suspense>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[min(300px,86vw)] shadow-2xl animate-[fadeIn_0.2s_ease]">
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

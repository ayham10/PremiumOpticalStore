"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Users,
  Package,
  Tag,
  ImageIcon,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Eye,
  Palette,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  group?: "appointments" | "catalogue" | "website" | "system";
}> = [
  {
    href: "/admin",
    labelKey: "admin.sidebar.dashboard",
    permission: "dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/appointments",
    labelKey: "admin.sidebar.appointments",
    permission: "appointments",
    icon: CalendarDays,
    group: "appointments",
  },
  {
    href: "/admin/eye-exam",
    labelKey: "admin.sidebar.eyeExam",
    permission: "appointments",
    icon: Eye,
    group: "appointments",
  },
  {
    href: "/admin/calendar",
    labelKey: "admin.sidebar.calendar",
    permission: "calendar",
    icon: CalendarRange,
    group: "appointments",
  },
  {
    href: "/admin/customers",
    labelKey: "admin.sidebar.customers",
    permission: "customers",
    icon: Users,
    group: "appointments",
  },
  {
    href: "/admin/inventory",
    labelKey: "admin.sidebar.inventory",
    permission: "inventory",
    icon: Package,
    group: "catalogue",
  },
  {
    href: "/admin/promotions",
    labelKey: "admin.sidebar.promotions",
    permission: "promotions",
    icon: Tag,
    group: "catalogue",
  },
  {
    href: "/admin/media",
    labelKey: "admin.sidebar.media",
    permission: "media",
    icon: ImageIcon,
    group: "website",
  },
  {
    href: "/admin/branding",
    labelKey: "admin.sidebar.branding",
    permission: "settings",
    icon: Palette,
    group: "website",
  },
  {
    href: "/admin/settings",
    labelKey: "admin.sidebar.settings",
    permission: "settings",
    icon: Settings,
    group: "website",
  },
  {
    href: "/admin/staff",
    labelKey: "admin.sidebar.staff",
    permission: "staff",
    icon: UserCog,
    group: "system",
  },
];

const GROUP_LABEL: Record<string, string> = {
  appointments: "admin.sidebar.groupAppointments",
  catalogue: "admin.sidebar.groupCatalogue",
  website: "admin.sidebar.website",
  system: "admin.sidebar.groupSystem",
};

export default function AdminSidebar({
  role,
  userName,
}: {
  role: UserRole;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { branding } = useBranding();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("has-mobile-nav-open", open);
    return () => document.body.classList.remove("has-mobile-nav-open");
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* continue to login */
    }
    router.replace("/admin/login");
  }

  const links = NAV.filter((item) => hasPermission(role, item.permission));

  const nav = (
    <aside className="admin-sidebar flex h-full min-h-full flex-col border-e border-[var(--line)] bg-[var(--admin-card,#13191E)]">
      <div className="border-b border-[var(--line)] px-5 py-6">
        <div className="mt-0.5">
          <BrandMark branding={branding} href="/admin" size="md" suffix="OPTICS" />
        </div>
        <p className="mt-2 text-xs font-medium text-[var(--slate)]">Admin</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {links.map((item, index) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const prev = links[index - 1];
          const showGroup = Boolean(item.group && item.group !== prev?.group);
          return (
            <div key={item.href}>
              {showGroup && item.group ? (
                <p className="mb-1 mt-3 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--slate)]">
                  {t(GROUP_LABEL[item.group])}
                </p>
              ) : null}
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn("admin-nav-link", active && "is-active")}
              >
                <Icon size={18} />
                {t(item.labelKey)}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--admin-elevated,#181F26)] px-3 py-3">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {userName || "Admin"}
          </p>
          <p className="truncate text-xs text-[var(--slate)]">
            {role === "admin" ? "Super Administrator" : role}
          </p>
        </div>
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

  return (
    <div className="relative z-40 md:contents">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(8,12,15,0.92)] px-4 py-3 backdrop-blur md:hidden">
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

      <div className="hidden h-full md:block">{nav}</div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "relative h-full w-[min(300px,86vw)] shadow-2xl transition-transform duration-300",
              "animate-[fadeIn_0.2s_ease]",
            )}
          >
            <button
              type="button"
              className="absolute end-3 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--admin-card,#13191E)] text-[var(--ink)]"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  );
}

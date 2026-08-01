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
} from "lucide-react";
import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/admin-permissions";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/format";
import { useLocale } from "@/components/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

const NAV: Array<{
  href: string;
  labelKey: string;
  permission: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { href: "/admin", labelKey: "admin.sidebar.dashboard", permission: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/appointments", labelKey: "admin.sidebar.appointments", permission: "appointments", icon: CalendarDays },
  { href: "/admin/eye-exam", labelKey: "admin.sidebar.eyeExam", permission: "appointments", icon: Eye },
  { href: "/admin/calendar", labelKey: "admin.sidebar.calendar", permission: "calendar", icon: CalendarRange },
  { href: "/admin/customers", labelKey: "admin.sidebar.customers", permission: "customers", icon: Users },
  { href: "/admin/inventory", labelKey: "admin.sidebar.inventory", permission: "inventory", icon: Package },
  { href: "/admin/promotions", labelKey: "admin.sidebar.promotions", permission: "promotions", icon: Tag },
  { href: "/admin/media", labelKey: "admin.sidebar.media", permission: "media", icon: ImageIcon },
  { href: "/admin/staff", labelKey: "admin.sidebar.staff", permission: "staff", icon: UserCog },
  { href: "/admin/settings", labelKey: "admin.sidebar.settings", permission: "settings", icon: Settings },
];

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
    <aside className="flex h-full min-h-full flex-col border-e border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-5 py-6">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Optical
        </p>
        <h1
          className="mt-1 text-2xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {t("admin.brand")}
        </h1>
        {userName ? (
          <p className="mt-2 truncate text-sm text-[var(--slate)]">{userName}</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {links.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--ink-soft)] hover:bg-[var(--mist)]"
              )}
            >
              <Icon size={18} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <div className="px-1 py-1">
          <LanguageSwitcher />
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--danger)] hover:bg-[#fdeaea]"
        >
          <LogOut size={18} />
          {t("admin.logout")}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="relative z-40 md:contents">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <span
          className="text-lg text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {t("admin.brand")}
        </span>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)]"
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
            className="absolute inset-0 bg-[rgba(16,21,28,0.45)] backdrop-blur-[2px]"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "relative h-full w-[min(300px,86vw)] shadow-2xl transition-transform duration-300",
              "animate-[fadeIn_0.2s_ease]"
            )}
          >
            <button
              type="button"
              className="absolute end-3 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-white"
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

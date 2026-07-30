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
} from "lucide-react";
import { useState } from "react";
import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/admin-permissions";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/format";

const NAV: Array<{
  href: string;
  label: string;
  permission: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { href: "/admin", label: "Dashboard", permission: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/appointments", label: "Appointments", permission: "appointments", icon: CalendarDays },
  { href: "/admin/calendar", label: "Calendar", permission: "calendar", icon: CalendarRange },
  { href: "/admin/customers", label: "Customers", permission: "customers", icon: Users },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory", icon: Package },
  { href: "/admin/promotions", label: "Promotions", permission: "promotions", icon: Tag },
  { href: "/admin/media", label: "Media", permission: "media", icon: ImageIcon },
  { href: "/admin/staff", label: "Staff", permission: "staff", icon: UserCog },
  { href: "/admin/settings", label: "Settings", permission: "settings", icon: Settings },
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
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
    <aside className="flex h-full min-h-screen flex-col border-r border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-5 py-6">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Optical
        </p>
        <h1
          className="mt-1 text-2xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          LUMINA Admin
        </h1>
        {userName ? (
          <p className="mt-2 truncate text-sm text-[var(--slate)]">{userName}</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--ink-soft)] hover:bg-[var(--mist)]"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--line)] p-3">
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--danger)] hover:bg-[#fdeaea]"
        >
          <LogOut size={18} />
          {loggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block">{nav}</div>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3 md:hidden">
        <span
          className="text-lg text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          LUMINA Admin
        </span>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)]"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(16,21,28,0.4)]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[min(280px,85vw)] shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white border border-[var(--line)]"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
    </>
  );
}

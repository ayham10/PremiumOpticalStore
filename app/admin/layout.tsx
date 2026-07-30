"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { AdminSession } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/admin-api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    (async () => {
      try {
        const data = await apiFetch<{ user: AdminSession } | AdminSession>(
          "/api/auth/me"
        );
        const user = "user" in data ? data.user : data;
        if (!cancelled) {
          setSession(user);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            router.replace("/admin/login");
          } else {
            router.replace("/admin/login");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router]);

  if (isLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        {children}
      </div>
    );
  }

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f5f8] text-[var(--slate)]">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar role={session.role} userName={session.name} />
      <div className="admin-main min-w-0 overflow-x-hidden">{children}</div>
    </div>
  );
}

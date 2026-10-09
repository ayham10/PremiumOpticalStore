"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminDesktopTopBar from "@/components/admin/AdminDesktopTopBar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { AdminSuccessNoticeProvider } from "@/components/admin/AdminSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AdminSession } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/admin-api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const isLogin = pathname === "/admin/login";
  const isContentPreview = pathname.startsWith("/admin/service-pages/preview");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(isLogin || isContentPreview);

  useEffect(() => {
    if (isContentPreview) {
      document.documentElement.classList.remove("admin-dark");
      document.body.classList.remove("admin-dark");
      return;
    }
    document.documentElement.classList.add("admin-dark");
    document.body.classList.add("admin-dark");
    return () => {
      document.documentElement.classList.remove("admin-dark");
      document.body.classList.remove("admin-dark");
    };
  }, [isContentPreview]);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (isContentPreview) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    (async () => {
      try {
        const data = await apiFetch<{ user: AdminSession } | AdminSession>(
          "/api/auth/me",
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
  }, [isLogin, isContentPreview, pathname, router]);

  if (isLogin) {
    return <div className="admin-auth">{children}</div>;
  }

  if (isContentPreview) {
    return <div className="csp-preview-root">{children}</div>;
  }

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[var(--slate)]">
        {t("admin.sidebar.loading")}
      </div>
    );
  }

  return (
    <AdminSuccessNoticeProvider>
      <div className="admin-shell">
        <AdminSidebar role={session.role} userName={session.name} />
        <div className="admin-main min-w-0 overflow-x-hidden">
          <AdminDesktopTopBar userName={session.name} />
          {children}
        </div>
      </div>
    </AdminSuccessNoticeProvider>
  );
}

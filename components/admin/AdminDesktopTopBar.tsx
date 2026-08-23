"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import AccountSettingsModal from "@/components/admin/AccountSettingsModal";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import type { AdminSession } from "@/lib/types";

const GOLD = "#D4AF37";

function initialsFromName(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase() || "AH";
}

function openShellNav() {
  window.dispatchEvent(new CustomEvent("admin-open-nav"));
  const btn = document.querySelector(
    "[data-admin-open-nav]",
  ) as HTMLButtonElement | null;
  btn?.click();
}

/** Shared desktop OYON header — centered logo in the usable content area */
export default function AdminDesktopTopBar({ userName }: { userName?: string }) {
  const { t } = useLocale();
  const { branding } = useBranding();
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileInitials, setProfileInitials] = useState(() =>
    initialsFromName(userName),
  );

  useEffect(() => {
    setProfileInitials(initialsFromName(userName));
  }, [userName]);

  useEffect(() => {
    async function refreshProfile() {
      try {
        const data = await apiFetch<{ user: AdminSession } | AdminSession>(
          "/api/auth/me",
        );
        const user = "user" in data ? data.user : data;
        setProfileInitials(initialsFromName(user.name));
      } catch {
        /* keep current initials */
      }
    }
    function onAccountUpdated() {
      void refreshProfile();
    }
    window.addEventListener("oyon:account-updated", onAccountUpdated);
    return () =>
      window.removeEventListener("oyon:account-updated", onAccountUpdated);
  }, []);

  return (
    <>
      <header className="admin-desktop-topbar admin-home-header relative hidden items-center md:flex">
        <div
          className="absolute top-1/2 flex -translate-y-1/2 items-center"
          style={{ insetInlineStart: 0 }}
        >
          <button
            type="button"
            aria-label={t("nav.menu")}
            onClick={openShellNav}
            className="admin-home-icon-btn grid place-items-center"
            style={{
              background: "transparent",
              border: "none",
              color: "#F2F4F6",
            }}
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
            onClick={() => setAccountOpen(true)}
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

      <AccountSettingsModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}

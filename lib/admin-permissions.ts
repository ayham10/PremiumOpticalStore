import type { UserRole } from "@/lib/types";

/** Client-safe copy of ROLE_PERMISSIONS from lib/auth.ts */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "dashboard",
    "appointments",
    "calendar",
    "customers",
    "inventory",
    "promotions",
    "media",
    "settings",
    "staff",
    "sms",
    "delete",
  ],
  employee: [
    "dashboard",
    "appointments",
    "calendar",
    "customers",
    "inventory",
    "promotions",
    "media",
    "sms",
  ],
  receptionist: ["dashboard", "appointments", "calendar", "customers", "sms"],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

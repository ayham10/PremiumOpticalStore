import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { AdminSession, UserRole } from "@/lib/types";

const SESSION_COOKIE = "lumina_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

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

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function envValue(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function hasAuthSecret(): boolean {
  return Boolean(envValue("AUTH_SECRET") || envValue("SUPABASE_SECRET_KEY"));
}

function secret(): string {
  const configured = envValue("AUTH_SECRET") || envValue("SUPABASE_SECRET_KEY");
  if (configured) return configured;
  if (isProductionRuntime()) {
    throw new Error("AUTH_SECRET_MISSING");
  }
  return "lumina-dev-secret-change-me";
}

let testSessionOverride: AdminSession | null | undefined;

function allowTestSessionOverride(): boolean {
  return (
    process.env.BOOKING_E2E_ISOLATED === "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}

/** Isolated tests only. Ignored in production. */
export function setTestSession(session: AdminSession | null | undefined): void {
  if (!allowTestSessionOverride()) return;
  testSessionOverride = session;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeSession(session: AdminSession & { exp: number }): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): (AdminSession & { exp: number }) | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AdminSession & { exp: number };
    if (!data?.id || !data?.email || !data?.role || !data?.exp) return null;
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function configuredPassword(envName: string, devFallback: string): string | null {
  const configured = envValue(envName);
  if (configured) return configured;
  if (isProductionRuntime()) return null;
  return devFallback;
}

function getAdminUsers(): Array<AdminSession & { password: string }> {
  const users: Array<AdminSession & { password: string }> = [];
  const adminPassword = configuredPassword("ADMIN_PASSWORD", "oyon2024");
  if (adminPassword) {
    users.push({
      id: "staff-maya",
      name: "Maya Cohen",
      email: envValue("ADMIN_EMAIL") || "admin@oyon.optics",
      role: "admin",
      password: adminPassword,
    });
  }
  const employeePassword = configuredPassword("EMPLOYEE_PASSWORD", "employee2024");
  if (employeePassword) {
    users.push({
      id: "staff-noah",
      name: "Noah Levi",
      email: "employee@oyon.optics",
      role: "employee",
      password: employeePassword,
    });
  }
  const receptionistPassword = configuredPassword(
    "RECEPTIONIST_PASSWORD",
    "reception2024",
  );
  if (receptionistPassword) {
    users.push({
      id: "staff-lina",
      name: "Lina Haddad",
      email: "receptionist@oyon.optics",
      role: "receptionist",
      password: receptionistPassword,
    });
  }
  return users;
}

export function authenticateUser(
  email: string,
  password: string
): AdminSession | null {
  if (isProductionRuntime() && !hasAuthSecret()) return null;

  const user = getAdminUsers().find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!user) return null;

  const a = Buffer.from(user.password);
  const b = Buffer.from(password);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function createSession(user: AdminSession): Promise<string> {
  const token = encodeSession({
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<AdminSession | null> {
  if (allowTestSessionOverride() && testSessionOverride !== undefined) {
    return testSessionOverride;
  }
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const data = decodeSession(token);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_SECRET_MISSING") {
      return null;
    }
    return null;
  }
}

export async function requireSession(
  permission?: string
): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (permission && !hasPermission(session.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { AdminSession, UserRole } from "@/lib/types";
import {
  findAdminByEmail,
  toSessionUser,
  verifyPassword,
} from "@/lib/admin-accounts";

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

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    "lumina-dev-secret-change-me"
  );
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

export async function authenticateUser(
  email: string,
  password: string
): Promise<AdminSession | null> {
  const user = await findAdminByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return toSessionUser(user);
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

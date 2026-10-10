import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { jsonError } from "@/lib/api/helpers";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_IP_LIMIT = 8;
const LOGIN_EMAIL_LIMIT = 5;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return jsonError("Email and password are required", 400);
    }

    const ipLimit = rateLimit(
      clientKeyFromRequest(request, "admin-login"),
      LOGIN_IP_LIMIT,
      LOGIN_WINDOW_MS,
    );
    const emailLimit = rateLimit(
      `admin-login-email:${email.toLowerCase()}`,
      LOGIN_EMAIL_LIMIT,
      LOGIN_WINDOW_MS,
    );
    if (!ipLimit.ok || !emailLimit.ok) {
      const retryAfterSec = Math.max(
        ipLimit.ok ? 0 : ipLimit.retryAfterSec,
        emailLimit.ok ? 0 : emailLimit.retryAfterSec,
      );
      return jsonError("Too many login attempts. Please try again shortly.", 429, {
        retryAfterSec,
      });
    }

    const user = authenticateUser(email, password);
    if (!user) {
      return jsonError("Invalid email or password", 401);
    }

    // Apply saved display-name override without changing login credentials
    try {
      const { getStore } = await import("@/lib/db/store");
      const { data } = await getStore();
      const saved = data.settings.adminDisplayNames?.[user.id]?.trim();
      if (saved) user.name = saved;
    } catch {
      /* keep hard-coded name */
    }

    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return jsonError("Login failed", 500);
  }
}

import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { jsonError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

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

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

    const user = await authenticateUser(email, password);
    if (!user) {
      return jsonError("Invalid email or password", 401);
    }

    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return jsonError("Login failed", 500);
  }
}

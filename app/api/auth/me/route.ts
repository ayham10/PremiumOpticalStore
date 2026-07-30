import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
    return NextResponse.json({ user: session });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to load session", 500);
  }
}

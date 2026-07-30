import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { handleRouteError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "1";
    const { data } = await getStore();

    const reviews = all
      ? [...data.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : data.reviews
          .filter((r) => r.featured)
          .sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ reviews });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  fillMissingLocaleCopy,
  type ProductLocaleCopy,
} from "@/lib/product-i18n";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireSession("inventory");
    const body = (await request.json()) as {
      from?: string;
      to?: string;
      copy?: ProductLocaleCopy;
    };
    const to = isLocale(body.to) ? body.to : null;
    if (!to || !body.copy) {
      return jsonError("Invalid translation payload", 400);
    }
    const from: Locale | "auto" = isLocale(body.from) ? body.from : "auto";
    const copy = await fillMissingLocaleCopy({
      source: body.copy,
      from,
      to,
    });
    return NextResponse.json({ copy });
  } catch (error) {
    return handleRouteError(error);
  }
}

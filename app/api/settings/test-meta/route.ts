import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import {
  getMetaWhatsAppConfig,
  isWhatsAppConfigured,
  metaGraphUrl,
  sanitizeWhatsAppError,
} from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSession("settings");

    if (!isWhatsAppConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Meta WhatsApp credentials are not configured on the server.",
        },
        { status: 400 },
      );
    }

    const config = getMetaWhatsAppConfig();
    const phoneResponse = await fetch(
      metaGraphUrl(
        `${config.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      ),
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        cache: "no-store",
      },
    );

    const phoneRaw = await phoneResponse.text().catch(() => "");
    let phoneJson: {
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      error?: { message?: string };
    } = {};
    if (phoneRaw) {
      try {
        phoneJson = JSON.parse(phoneRaw) as typeof phoneJson;
      } catch {
        phoneJson = {};
      }
    }

    if (!phoneResponse.ok) {
      const detail =
        phoneJson.error?.message ||
        sanitizeWhatsAppError(phoneRaw) ||
        `Meta WhatsApp API error ${phoneResponse.status}`;
      return NextResponse.json(
        {
          ok: false,
          error: detail,
        },
        { status: 400 },
      );
    }

    let wabaName: string | undefined;
    if (config.wabaId) {
      const wabaResponse = await fetch(
        metaGraphUrl(`${config.wabaId}?fields=name`),
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
          cache: "no-store",
        },
      );
      if (wabaResponse.ok) {
        const wabaJson = (await wabaResponse.json().catch(() => ({}))) as {
          name?: string;
        };
        wabaName = wabaJson.name;
      }
    }

    const displayNumber = phoneJson.display_phone_number || "configured number";
    const verifiedName = phoneJson.verified_name || "Meta WhatsApp Cloud API";

    return NextResponse.json({
      ok: true,
      message: `Meta WhatsApp Cloud API connected (${verifiedName}, ${displayNumber}).`,
      phoneNumberId: config.phoneNumberId,
      wabaConfigured: Boolean(config.wabaId),
      wabaName,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

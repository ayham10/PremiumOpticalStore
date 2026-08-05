import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import { mergeBranding } from "@/lib/branding";
import { ensureFutureAvailability } from "@/lib/eye-exam";
import type { StoreSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export type PublicSettings = Omit<StoreSettings, "smtp"> & {
  sms: {
    enabled: boolean;
    provider?: StoreSettings["sms"]["provider"];
  };
};

function toPublicSettings(settings: StoreSettings): PublicSettings {
  return {
    storeName: settings.storeName,
    tagline: settings.tagline,
    logo: settings.logo || settings.branding?.logo,
    address: settings.address,
    city: settings.city,
    phone: settings.phone,
    email: settings.email,
    whatsapp: settings.whatsapp,
    googleMapsEmbedUrl: settings.googleMapsEmbedUrl,
    googleMapsLink: settings.googleMapsLink,
    openingHours: settings.openingHours,
    social: settings.social,
    seo: settings.seo,
    content: settings.content,
    branding: mergeBranding(settings.branding),
    sms: {
      enabled: Boolean(settings.sms?.enabled),
      provider: settings.sms?.provider,
    },
    appointmentSlotMinutes: settings.appointmentSlotMinutes,
    bookingLeadDays: settings.bookingLeadDays,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = searchParams.get("admin") === "1";
    const { data } = await getStore();

    if (admin) {
      await requireSession("settings");
      return NextResponse.json({ settings: data.settings });
    }

    return NextResponse.json({ settings: toPublicSettings(data.settings) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("settings");
    const body = (await request.json()) as { settings?: Partial<StoreSettings> };
    const patch = body.settings ?? (body as Partial<StoreSettings>);

    if (!patch || typeof patch !== "object") {
      return jsonError("Settings payload is required", 400);
    }

    let settings: StoreSettings | null = null;

    await updateStore((store) => {
      const next: StoreSettings = {
        ...store.settings,
        ...patch,
        social: {
          ...store.settings.social,
          ...(patch.social || {}),
        },
        seo: {
          ...store.settings.seo,
          ...(patch.seo || {}),
        },
        smtp: {
          ...store.settings.smtp,
          ...(patch.smtp || {}),
        },
        sms: {
          ...store.settings.sms,
          ...(patch.sms || {}),
        },
        content: {
          ...store.settings.content,
          ...(patch.content || {}),
          heroTitle: {
            ...store.settings.content?.heroTitle,
            ...(patch.content?.heroTitle || {}),
          },
          heroLine: {
            ...store.settings.content?.heroLine,
            ...(patch.content?.heroLine || {}),
          },
          brandSuffix: {
            ...store.settings.content?.brandSuffix,
            ...(patch.content?.brandSuffix || {}),
          },
        },
        branding: mergeBranding({
          ...store.settings.branding,
          ...(patch.branding || {}),
          colors: {
            ...mergeBranding(store.settings.branding).colors,
            ...(patch.branding?.colors || {}),
          },
          typography: {
            ...mergeBranding(store.settings.branding).typography,
            ...(patch.branding?.typography || {}),
          },
          storeNameStyle: {
            ...mergeBranding(store.settings.branding).storeNameStyle,
            ...(patch.branding?.storeNameStyle || {}),
          },
        }),
        openingHours: Array.isArray(patch.openingHours)
          ? patch.openingHours
          : store.settings.openingHours,
      };

      if (next.branding?.storeNameEn) {
        next.storeName = next.branding.storeNameEn;
      }
      if (next.branding?.logo) {
        next.logo = next.branding.logo;
      }

      if (typeof next.appointmentSlotMinutes === "number") {
        next.appointmentSlotMinutes = Math.max(15, Math.min(120, next.appointmentSlotMinutes));
      }
      if (typeof next.bookingLeadDays === "number") {
        next.bookingLeadDays = Math.max(1, Math.min(365, next.bookingLeadDays));
      }

      store.settings = next;
      settings = next;

      // Keep public booking calendar in sync with weekly opening hours
      store.eyeExamAvailability = ensureFutureAvailability(
        store.eyeExamAvailability,
        next,
        { forceRefreshDefaults: Array.isArray(patch.openingHours) },
      );

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "settings",
        detail: "Store settings updated",
      });
      return store;
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}

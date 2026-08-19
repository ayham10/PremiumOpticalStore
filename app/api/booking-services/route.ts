import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import {
  activeBookingServices,
  createDefaultBookingServices,
  isActiveBookingServiceKey,
  isBookingServiceKey,
  resolveBookingServiceLocale,
  serializePublicBookingService,
  sortBookingServices,
} from "@/lib/booking-services";
import { getStore, invalidateStoreCache, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import { slugify } from "@/lib/format";
import type { BookingService, LocalizedContent } from "@/lib/types";

export const dynamic = "force-dynamic";

function sanitizeLocalized(
  input: Partial<LocalizedContent> | undefined,
  existing?: LocalizedContent,
): LocalizedContent {
  const next: LocalizedContent = {
    ar: (input?.ar ?? existing?.ar ?? "").trim(),
    en: (input?.en ?? existing?.en ?? "").trim(),
    he: (input?.he ?? existing?.he ?? "").trim(),
  };
  return next;
}

function sanitizeServiceInput(
  input: Partial<BookingService>,
  existing?: BookingService,
): Omit<BookingService, "id" | "createdAt" | "updatedAt"> | null {
  const name = sanitizeLocalized(input.name, existing?.name);
  const description = sanitizeLocalized(input.description, existing?.description);
  const label = name.ar || name.en || name.he;
  if (!label) return null;

  const keyRaw = (input.key ?? existing?.key ?? slugify(label)).trim();
  const key = keyRaw.replace(/-/g, "_").toLowerCase();
  if (!isBookingServiceKey(key)) return null;

  const icon = String(input.icon ?? existing?.icon ?? "calendar").trim();
  const sortOrder = Number(input.sortOrder ?? existing?.sortOrder ?? 0);
  const active =
    typeof input.active === "boolean" ? input.active : existing?.active ?? true;

  return {
    key,
    name,
    description,
    icon,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    active,
  };
}

function uniqueKey(key: string, services: BookingService[], ignoreId?: string) {
  return services.some((s) => s.key === key && s.id !== ignoreId);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get("locale");
    const locale = resolveBookingServiceLocale(localeParam);
    const { data } = await getStore();
    let services = sortBookingServices(
      data.bookingServices?.length
        ? data.bookingServices
        : createDefaultBookingServices(),
    );

    // Public /book always sends ?locale= — never return nested {ar,en,he} objects.
    if (localeParam) {
      services = activeBookingServices(services);
      return NextResponse.json(
        {
          services: services.map((s) =>
            serializePublicBookingService(s, locale),
          ),
        },
        {
          headers: {
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          },
        },
      );
    }

    try {
      await requireSession("appointments");
      return NextResponse.json(
        { services },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } catch {
      services = activeBookingServices(services);
      return NextResponse.json(
        {
          services: services.map((s) =>
            serializePublicBookingService(s, locale),
          ),
        },
        {
          headers: {
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          },
        },
      );
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as Partial<BookingService>;
    const fields = sanitizeServiceInput(body);
    if (!fields) return jsonError("Invalid booking service payload", 400);

    const now = new Date().toISOString();
    let created: BookingService | null = null;

    await updateStore((store) => {
      if (uniqueKey(fields.key, store.bookingServices || [])) {
        throw new Error("KEY_EXISTS");
      }
      created = {
        id: newId("bsvc"),
        ...fields,
        createdAt: now,
        updatedAt: now,
      };
      store.bookingServices = sortBookingServices([
        ...(store.bookingServices || []),
        created,
      ]);
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "booking_service",
        entityId: created.id,
        detail: fields.key,
      });
      return store;
    });

    invalidateStoreCache();
    return NextResponse.json({ service: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "KEY_EXISTS") {
      return jsonError("A service with this key already exists", 409);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as Partial<BookingService> & { id?: string };
    if (!body.id) return jsonError("Service id is required", 400);

    let updated: BookingService | null = null;

    await updateStore((store) => {
      const index = (store.bookingServices || []).findIndex((s) => s.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");
      const current = store.bookingServices[index];
      const fields = sanitizeServiceInput(
        { ...body, key: current.key },
        current,
      );
      if (!fields) throw new Error("INVALID");
      if (uniqueKey(fields.key, store.bookingServices || [], current.id)) {
        throw new Error("KEY_EXISTS");
      }
      updated = {
        ...current,
        ...fields,
        key: current.key,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.bookingServices[index] = updated;
      store.bookingServices = sortBookingServices(store.bookingServices);
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "booking_service",
        entityId: updated.id,
        detail: updated.key,
      });
      return store;
    });

    invalidateStoreCache();
    return NextResponse.json({ service: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return jsonError("Booking service not found", 404);
      }
      if (error.message === "INVALID") {
        return jsonError("Invalid booking service payload", 400);
      }
      if (error.message === "KEY_EXISTS") {
        return jsonError("A service with this key already exists", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as {
      order?: Array<{ id: string; sortOrder: number }>;
    };
    if (!Array.isArray(body.order) || !body.order.length) {
      return jsonError("Order payload is required", 400);
    }

    await updateStore((store) => {
      const byId = new Map((store.bookingServices || []).map((s) => [s.id, s]));
      for (const row of body.order!) {
        const current = byId.get(row.id);
        if (!current) continue;
        current.sortOrder = Number(row.sortOrder) || 0;
        current.updatedAt = new Date().toISOString();
      }
      store.bookingServices = sortBookingServices(Array.from(byId.values()));
      pushActivity(store, {
        actor: session.email,
        action: "reorder",
        entity: "booking_service",
        detail: `${body.order!.length} services`,
      });
      return store;
    });

    invalidateStoreCache();
    const { data } = await getStore();
    return NextResponse.json({ services: data.bookingServices });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("appointments");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return jsonError("Service id is required", 400);

    await updateStore((store) => {
      const index = (store.bookingServices || []).findIndex((s) => s.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      const row = store.bookingServices[index];
      const hasBookings = store.eyeExamAppointments.some(
        (a) => a.appointmentType === row.key && a.status !== "cancelled",
      );
      if (hasBookings) {
        store.bookingServices[index] = {
          ...row,
          active: false,
          updatedAt: new Date().toISOString(),
        };
      } else {
        store.bookingServices.splice(index, 1);
      }
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "booking_service",
        entityId: id,
        detail: row.key,
      });
      return store;
    });

    invalidateStoreCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Booking service not found", 404);
    }
    return handleRouteError(error);
  }
}

export { isActiveBookingServiceKey };

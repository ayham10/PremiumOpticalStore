import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type { ServiceType, StaffMember, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES = new Set<UserRole>(["admin", "employee", "receptionist"]);

const SERVICES = new Set<ServiceType>([
  "Eye Examination",
  "Prescription Glasses",
  "Sunglasses Fitting",
  "Contact Lenses",
  "Eyeglass Frames",
  "Vision Consultation",
  "Lens Fitting",
]);

function sanitize(
  input: Partial<StaffMember>,
  existing?: StaffMember
): Omit<StaffMember, "id" | "createdAt" | "updatedAt"> | null {
  const name = (input.name ?? existing?.name)?.trim();
  const email = (input.email ?? existing?.email)?.trim().toLowerCase();
  const title = (input.title ?? existing?.title)?.trim();
  const role = (input.role ?? existing?.role) as UserRole | undefined;
  const color = (input.color ?? existing?.color)?.trim() || "#1a4a6b";

  if (!name || !email || !title || !role || !ROLES.has(role)) return null;

  const specialties = Array.isArray(input.specialties)
    ? input.specialties.filter((s): s is ServiceType => SERVICES.has(s as ServiceType))
    : existing?.specialties ?? [];

  return {
    name,
    email,
    phone: input.phone ?? existing?.phone,
    role,
    title,
    bio: input.bio ?? existing?.bio,
    image: input.image ?? existing?.image,
    specialties,
    active: Boolean(input.active ?? existing?.active ?? true),
    color,
  };
}

export async function GET() {
  try {
    await requireSession("staff");
    const { data } = await getStore();
    const staff = [...data.staff].sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({
      staff,
      holidays: data.holidays,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("staff");
    const body = (await request.json()) as Partial<StaffMember>;
    const fields = sanitize(body);
    if (!fields) return jsonError("Invalid staff payload", 400);

    const now = new Date().toISOString();
    const member: StaffMember = {
      id: newId("staff"),
      ...fields,
      createdAt: now,
      updatedAt: now,
    };

    await updateStore((store) => {
      if (store.staff.some((s) => s.email.toLowerCase() === member.email)) {
        throw new Error("DUPLICATE");
      }
      store.staff.unshift(member);
      store.availability.push({
        staffId: member.id,
        workingHours: store.settings.openingHours,
        unavailableDates: [],
      });
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "staff",
        entityId: member.id,
        detail: member.name,
      });
      return store;
    });

    return NextResponse.json({ staff: member }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE") {
      return jsonError("Staff with this email already exists", 409);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("staff");
    const body = (await request.json()) as Partial<StaffMember> & { id?: string };
    if (!body.id) return jsonError("Staff id is required", 400);

    let updated: StaffMember | null = null;

    await updateStore((store) => {
      const index = store.staff.findIndex((s) => s.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      const fields = sanitize(body, store.staff[index]);
      if (!fields) throw new Error("INVALID");

      const duplicate = store.staff.find(
        (s) => s.id !== body.id && s.email.toLowerCase() === fields.email
      );
      if (duplicate) throw new Error("DUPLICATE");

      updated = {
        ...store.staff[index],
        ...fields,
        id: store.staff[index].id,
        createdAt: store.staff[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.staff[index] = updated;

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "staff",
        entityId: updated.id,
        detail: updated.name,
      });
      return store;
    });

    return NextResponse.json({ staff: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Staff not found", 404);
      if (error.message === "INVALID") return jsonError("Invalid staff payload", 400);
      if (error.message === "DUPLICATE") {
        return jsonError("Staff with this email already exists", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("staff");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Staff id is required", 400);

    let removed: StaffMember | null = null;

    await updateStore((store) => {
      const index = store.staff.findIndex((s) => s.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.staff[index];
      store.staff.splice(index, 1);
      store.availability = store.availability.filter((a) => a.staffId !== id);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "staff",
        entityId: id,
        detail: removed.name,
      });
      return store;
    });

    return NextResponse.json({ ok: true, staff: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Staff not found", 404);
    }
    return handleRouteError(error);
  }
}

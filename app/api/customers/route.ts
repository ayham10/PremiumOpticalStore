import { NextResponse } from "next/server";
import { hasPermission, newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSession("customers");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const { data } = await getStore();

    let customers = [...data.customers];
    if (q) {
      customers = customers.filter((c) =>
        [c.name, c.email, c.phone, c.notes]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }

    customers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json({ customers });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("customers");
    const body = (await request.json()) as Partial<Customer>;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim();

    if (!name || !email || !phone) {
      return jsonError("Name, email, and phone are required", 400);
    }

    const now = new Date().toISOString();
    const customer: Customer = {
      id: newId("cus"),
      name,
      email,
      phone,
      notes: body.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await updateStore((store) => {
      const duplicate = store.customers.find(
        (c) =>
          c.email.toLowerCase() === email ||
          c.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")
      );
      if (duplicate) throw new Error("DUPLICATE");

      store.customers.unshift(customer);
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "customer",
        entityId: customer.id,
        detail: customer.name,
      });
      return store;
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE") {
      return jsonError("Customer with this email or phone already exists", 409);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("customers");
    const body = (await request.json()) as Partial<Customer> & { id?: string };
    if (!body.id) return jsonError("Customer id is required", 400);

    let updated: Customer | null = null;

    await updateStore((store) => {
      const index = store.customers.findIndex((c) => c.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      const name = (body.name ?? store.customers[index].name).trim();
      const email = (body.email ?? store.customers[index].email).trim().toLowerCase();
      const phone = (body.phone ?? store.customers[index].phone).trim();

      if (!name || !email || !phone) throw new Error("INVALID");

      const duplicate = store.customers.find(
        (c) =>
          c.id !== body.id &&
          (c.email.toLowerCase() === email ||
            c.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""))
      );
      if (duplicate) throw new Error("DUPLICATE");

      updated = {
        ...store.customers[index],
        name,
        email,
        phone,
        notes:
          body.notes !== undefined
            ? body.notes.trim() || undefined
            : store.customers[index].notes,
        updatedAt: new Date().toISOString(),
      };
      store.customers[index] = updated;

      // Keep appointment denormalized customer fields in sync
      store.appointments = store.appointments.map((a) =>
        a.customerId === updated!.id
          ? {
              ...a,
              customerName: updated!.name,
              customerEmail: updated!.email,
              customerPhone: updated!.phone,
            }
          : a
      );

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "customer",
        entityId: updated.id,
        detail: updated.name,
      });
      return store;
    });

    return NextResponse.json({ customer: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Customer not found", 404);
      if (error.message === "INVALID") {
        return jsonError("Name, email, and phone are required", 400);
      }
      if (error.message === "DUPLICATE") {
        return jsonError("Customer with this email or phone already exists", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("customers");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Customer id is required", 400);

    if (!hasPermission(session.role, "delete")) {
      throw new Error("FORBIDDEN");
    }

    let removed: Customer | null = null;

    await updateStore((store) => {
      const index = store.customers.findIndex((c) => c.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.customers[index];
      store.customers.splice(index, 1);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "customer",
        entityId: id,
        detail: removed.name,
      });
      return store;
    });

    return NextResponse.json({ ok: true, customer: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Customer not found", 404);
    }
    return handleRouteError(error);
  }
}

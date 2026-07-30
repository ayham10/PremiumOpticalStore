import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type { ContactMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSession("settings");
    const { searchParams } = new URL(request.url);
    const unread = searchParams.get("unread");
    const { data } = await getStore();

    let messages = [...data.contactMessages];
    if (unread === "1" || unread === "true") {
      messages = messages.filter((m) => !m.read);
    }
    messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const subject = body.subject?.trim();
    const message = body.message?.trim();
    const phone = body.phone?.trim();

    if (!name || !email || !subject || !message) {
      return jsonError("Name, email, subject, and message are required", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Invalid email address", 400);
    }

    const entry: ContactMessage = {
      id: newId("msg"),
      name,
      email,
      phone: phone || undefined,
      subject,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };

    await updateStore((store) => {
      store.contactMessages.unshift(entry);
      return store;
    });

    return NextResponse.json({ message: entry }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession("settings");
    const body = (await request.json()) as {
      id?: string;
      read?: boolean;
    };

    if (!body.id) return jsonError("Message id is required", 400);

    let updated: ContactMessage | null = null;

    await updateStore((store) => {
      const index = store.contactMessages.findIndex((m) => m.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      updated = {
        ...store.contactMessages[index],
        read: body.read ?? true,
      };
      store.contactMessages[index] = updated;

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "contact_message",
        entityId: updated.id,
        detail: `read=${updated.read}`,
      });
      return store;
    });

    return NextResponse.json({ message: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Message not found", 404);
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("settings");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Message id is required", 400);

    let removed: ContactMessage | null = null;

    await updateStore((store) => {
      const index = store.contactMessages.findIndex((m) => m.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.contactMessages[index];
      store.contactMessages.splice(index, 1);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "contact_message",
        entityId: id,
        detail: removed.subject,
      });
      return store;
    });

    return NextResponse.json({ ok: true, message: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Message not found", 404);
    }
    return handleRouteError(error);
  }
}

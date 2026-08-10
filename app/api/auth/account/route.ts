import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api/helpers";
import { getStore, updateStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);

    const { data } = await getStore();
    const saved = data.settings.adminDisplayNames?.[session.id]?.trim();

    return NextResponse.json({
      user: {
        id: session.id,
        name: saved || session.name,
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError("Failed to load account", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);

    const body = (await request.json()) as { name?: string };
    const name = (body.name || "").trim();
    if (!name) {
      return jsonError("الاسم مطلوب", 400, { field: "name" });
    }

    await updateStore((data) => ({
      ...data,
      settings: {
        ...data.settings,
        adminDisplayNames: {
          ...(data.settings.adminDisplayNames || {}),
          [session.id]: name,
        },
      },
    }));

    const nextSession = { ...session, name };
    await createSession(nextSession);

    return NextResponse.json({
      user: nextSession,
      message: "تم حفظ التغييرات بنجاح",
    });
  } catch (error) {
    console.error(error);
    return jsonError("فشل حفظ الحساب", 500);
  }
}

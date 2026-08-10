import { NextResponse } from "next/server";
import {
  findAdminById,
  hashPassword,
  toSessionUser,
  updateAdminAccount,
  verifyPassword,
} from "@/lib/admin-accounts";
import { createSession, getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);
    const stored = await findAdminById(session.id);
    if (!stored) return jsonError("Unauthorized", 401);
    return NextResponse.json({
      user: {
        id: stored.id,
        name: stored.name,
        email: stored.email,
        role: stored.role,
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

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const currentPassword = body.currentPassword || "";
    const newPassword = body.newPassword || "";
    const confirmPassword = body.confirmPassword || "";

    if (!name) {
      return jsonError("الاسم مطلوب", 400, { field: "name" });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("البريد الإلكتروني غير صالح", 400, { field: "email" });
    }
    if (!currentPassword) {
      return jsonError("أدخل كلمة المرور الحالية", 400, {
        field: "currentPassword",
      });
    }

    const stored = await findAdminById(session.id);
    if (!stored) return jsonError("Unauthorized", 401);

    if (!verifyPassword(currentPassword, stored.passwordHash)) {
      return jsonError("كلمة المرور الحالية غير صحيحة", 401, {
        field: "currentPassword",
      });
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        return jsonError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", 400, {
          field: "newPassword",
        });
      }
      if (newPassword !== confirmPassword) {
        return jsonError("تأكيد كلمة المرور غير متطابق", 400, {
          field: "confirmPassword",
        });
      }
    }

    let updated;
    try {
      updated = await updateAdminAccount(session.id, {
        name,
        email,
        passwordHash: newPassword ? hashPassword(newPassword) : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_TAKEN") {
        return jsonError("هذا البريد الإلكتروني مستخدم بالفعل", 409, {
          field: "email",
        });
      }
      throw err;
    }

    const nextSession = toSessionUser(updated);
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

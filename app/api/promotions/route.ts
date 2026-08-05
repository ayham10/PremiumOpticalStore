import { NextResponse } from "next/server";
import { isPromotionActive } from "@/lib/appointments";
import { getSession, hasPermission, newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type {
  DiscountType,
  Promotion,
  PromotionScope,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const SCOPES: PromotionScope[] = ["all", "sunglasses", "frames", "specific"];
const DISCOUNT_TYPES: DiscountType[] = ["percentage", "fixed"];

function buildDiscountDisplay(
  discountType: DiscountType | undefined,
  discountValue: number | undefined,
  explicit?: string
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  if (discountType === "percentage" && typeof discountValue === "number") {
    return `${discountValue}%`;
  }
  if (discountType === "fixed" && typeof discountValue === "number") {
    return `₪${discountValue}`;
  }
  return "";
}

function sanitizePromotion(
  input: Partial<Promotion>,
  existing?: Promotion
): Omit<Promotion, "id" | "createdAt" | "updatedAt"> | null {
  const title = (input.title ?? existing?.title)?.trim();
  const description = (input.description ?? existing?.description)?.trim();
  const startDate = (input.startDate ?? existing?.startDate)?.trim();
  const endDate = (input.endDate ?? existing?.endDate)?.trim();

  const rawType = input.discountType ?? existing?.discountType;
  const discountType: DiscountType | undefined =
    rawType && DISCOUNT_TYPES.includes(rawType) ? rawType : undefined;

  const rawValue = input.discountValue ?? existing?.discountValue;
  const discountValue =
    rawValue === undefined || rawValue === null || Number.isNaN(Number(rawValue))
      ? undefined
      : Number(rawValue);

  const discount = buildDiscountDisplay(
    discountType,
    discountValue,
    input.discount ?? existing?.discount
  );

  const rawScope = input.scope ?? existing?.scope ?? "all";
  const scope: PromotionScope = SCOPES.includes(rawScope as PromotionScope)
    ? (rawScope as PromotionScope)
    : "all";

  const rawIds = input.productIds ?? existing?.productIds ?? [];
  const productIds = Array.isArray(rawIds)
    ? rawIds.map(String).filter(Boolean)
    : [];

  if (!title || !description || !discount || !startDate || !endDate) {
    return null;
  }

  return {
    title,
    description,
    discount,
    discountType,
    discountValue,
    scope,
    productIds: scope === "specific" ? productIds : [],
    couponCode: input.couponCode ?? existing?.couponCode,
    image: input.image ?? existing?.image,
    startDate,
    endDate,
    homepageVisible: Boolean(
      input.homepageVisible ?? existing?.homepageVisible ?? true
    ),
    priority: Number(input.priority ?? existing?.priority ?? 0) || 0,
    active: Boolean(input.active ?? existing?.active ?? true),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    const isAdmin = session && hasPermission(session.role, "promotions");
    const { data } = await getStore();

    if (isAdmin) {
      const promotions = [...data.promotions].sort(
        (a, b) => a.priority - b.priority || b.startDate.localeCompare(a.startDate)
      );
      return NextResponse.json({ promotions });
    }

    const promotions = data.promotions
      .filter(
        (p) =>
          p.homepageVisible &&
          isPromotionActive(p.startDate, p.endDate, p.active)
      )
      .sort((a, b) => a.priority - b.priority);

    return NextResponse.json({ promotions });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("promotions");
    const body = (await request.json()) as Partial<Promotion>;
    const fields = sanitizePromotion(body);
    if (!fields) return jsonError("Invalid promotion payload", 400);

    const now = new Date().toISOString();
    const promotion: Promotion = {
      id: newId("promo"),
      ...fields,
      createdAt: now,
      updatedAt: now,
    };

    await updateStore((store) => {
      store.promotions.unshift(promotion);
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "promotion",
        entityId: promotion.id,
        detail: promotion.title,
      });
      return store;
    });

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("promotions");
    const body = (await request.json()) as Partial<Promotion> & { id?: string };
    if (!body.id) return jsonError("Promotion id is required", 400);

    let updated: Promotion | null = null;

    await updateStore((store) => {
      const index = store.promotions.findIndex((p) => p.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      const fields = sanitizePromotion(body, store.promotions[index]);
      if (!fields) throw new Error("INVALID");

      updated = {
        ...store.promotions[index],
        ...fields,
        id: store.promotions[index].id,
        createdAt: store.promotions[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.promotions[index] = updated;

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "promotion",
        entityId: updated.id,
        detail: updated.title,
      });
      return store;
    });

    return NextResponse.json({ promotion: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Promotion not found", 404);
      if (error.message === "INVALID") return jsonError("Invalid promotion payload", 400);
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("promotions");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Promotion id is required", 400);

    let removed: Promotion | null = null;

    await updateStore((store) => {
      const index = store.promotions.findIndex((p) => p.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.promotions[index];
      store.promotions.splice(index, 1);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "promotion",
        entityId: id,
        detail: removed.title,
      });
      return store;
    });

    return NextResponse.json({ ok: true, promotion: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Promotion not found", 404);
    }
    return handleRouteError(error);
  }
}

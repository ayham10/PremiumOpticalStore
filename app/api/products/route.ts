import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import { slugify } from "@/lib/format";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type { Product, ProductCategory, ProductStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function isProductCategory(value: string): value is ProductCategory {
  return [
    "Prescription Glasses",
    "Sunglasses",
    "Contact Lenses",
    "Frames",
    "Accessories",
    "Cleaning Products",
  ].includes(value);
}

function sanitizeProductInput(
  input: Partial<Product>,
  existing?: Product
): Omit<Product, "id" | "createdAt" | "updatedAt"> | null {
  const name = (input.name ?? existing?.name)?.trim();
  const brand = (input.brand ?? existing?.brand)?.trim();
  const category = input.category ?? existing?.category;
  const description = (input.description ?? existing?.description ?? "").trim();
  const sku = (input.sku ?? existing?.sku)?.trim();

  if (!name || !brand || !category || !sku || !isProductCategory(category)) {
    return null;
  }

  const sellingPrice = Number(input.sellingPrice ?? existing?.sellingPrice ?? 0);
  const purchasePrice = Number(input.purchasePrice ?? existing?.purchasePrice ?? 0);
  const stockQuantity = Number(input.stockQuantity ?? existing?.stockQuantity ?? 0);
  const minimumStock = Number(input.minimumStock ?? existing?.minimumStock ?? 0);
  const status = (input.status ?? existing?.status ?? "active") as ProductStatus;

  return {
    slug: slugify(input.slug || existing?.slug || name),
    name,
    category,
    brand,
    frameType: input.frameType ?? existing?.frameType,
    lensType: input.lensType ?? existing?.lensType,
    barcode: input.barcode ?? existing?.barcode,
    sku,
    description,
    images: Array.isArray(input.images)
      ? input.images.filter((u): u is string => typeof u === "string")
      : existing?.images ?? [],
    purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
    minimumStock: Number.isFinite(minimumStock) ? minimumStock : 0,
    supplierId: input.supplierId ?? existing?.supplierId,
    status,
    featured: Boolean(input.featured ?? existing?.featured ?? false),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get("featured");
    const category = searchParams.get("category");
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const all = searchParams.get("all") === "1";

    const { data } = await getStore();
    let products = data.products;

    // Public listing defaults to active products; admins with inventory can request all
    if (!all) {
      products = products.filter((p) => p.status === "active" || p.status === "out_of_stock");
    } else {
      try {
        await requireSession("inventory");
      } catch {
        products = products.filter((p) => p.status === "active" || p.status === "out_of_stock");
      }
    }

    if (featured === "1" || featured === "true") {
      products = products.filter((p) => p.featured);
    }

    if (category) {
      products = products.filter((p) => p.category === category);
    }

    if (q) {
      products = products.filter((p) =>
        [p.name, p.brand, p.sku, p.barcode, p.description, p.category]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ products });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as Partial<Product>;
    const fields = sanitizeProductInput(body);
    if (!fields) {
      return jsonError("Invalid product payload", 400);
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: newId("prod"),
      ...fields,
      createdAt: now,
      updatedAt: now,
    };

    const { data } = await updateStore((store) => {
      if (store.products.some((p) => p.sku === product.sku || p.slug === product.slug)) {
        throw new Error("Product with this SKU or slug already exists");
      }
      store.products.unshift(product);
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "product",
        entityId: product.id,
        detail: product.name,
      });
      return store;
    });

    return NextResponse.json(
      { product: data.products.find((p) => p.id === product.id) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return jsonError(error.message, 409);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as Partial<Product> & { id?: string };

    if (!body.id) {
      return jsonError("Product id is required", 400);
    }

    let updated: Product | null = null;

    await updateStore((store) => {
      const index = store.products.findIndex((p) => p.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      const fields = sanitizeProductInput(body, store.products[index]);
      if (!fields) throw new Error("INVALID");

      const conflict = store.products.some(
        (p) =>
          p.id !== body.id &&
          (p.sku === fields.sku || p.slug === fields.slug)
      );
      if (conflict) throw new Error("CONFLICT");

      updated = {
        ...store.products[index],
        ...fields,
        id: store.products[index].id,
        createdAt: store.products[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.products[index] = updated;

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "product",
        entityId: updated.id,
        detail: updated.name,
      });
      return store;
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Product not found", 404);
      if (error.message === "INVALID") return jsonError("Invalid product payload", 400);
      if (error.message === "CONFLICT") {
        return jsonError("Product with this SKU or slug already exists", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("inventory");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Product id is required", 400);

    let removed: Product | null = null;

    await updateStore((store) => {
      const index = store.products.findIndex((p) => p.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.products[index];
      store.products.splice(index, 1);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "product",
        entityId: id,
        detail: removed.name,
      });
      return store;
    });

    return NextResponse.json({ ok: true, product: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Product not found", 404);
    }
    return handleRouteError(error);
  }
}

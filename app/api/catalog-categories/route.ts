import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import {
  applyCategoryDelete,
  categoryLabel,
  countCategoryProducts,
  createCatalogCategory,
  isSystemCategoryId,
  MAX_CUSTOM_CATEGORIES,
  mergeCatalogCategories,
  namesHaveContent,
  sanitizeCategoryNames,
  SYSTEM_CATEGORY_IDS,
} from "@/lib/catalog-categories";
import type { CatalogCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

function withCounts(categories: CatalogCategory[], products: { category?: string; categoryIds?: string[] }[]) {
  return categories.map((item) => ({
    ...item,
    productCount: countCategoryProducts(products, item.id),
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "1";
    const locale = searchParams.get("locale")?.trim() || "ar";
    const { data } = await getStore();
    const categories = mergeCatalogCategories(data.catalogCategories);

    if (all) {
      try {
        await requireSession("inventory");
        return NextResponse.json({
          categories: withCounts(categories, data.products),
        });
      } catch {
        /* public fallback */
      }
    }

    const visible = categories.filter((item) => item.showInMainCatalog);
    return NextResponse.json({
      categories: visible.map((item) => ({
        id: item.id,
        name: categoryLabel(item, locale),
        showInMainCatalog: true,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as {
      names?: unknown;
      showInMainCatalog?: boolean;
    };
    const names = sanitizeCategoryNames(body.names);
    if (!namesHaveContent(names)) {
      return jsonError("Category name is required", 400);
    }

    let created: CatalogCategory | null = null;
    await updateStore((store) => {
      const current = mergeCatalogCategories(store.catalogCategories);
      const customCount = current.filter((item) => !item.system).length;
      if (customCount >= MAX_CUSTOM_CATEGORIES) {
        throw new Error("LIMIT");
      }
      created = createCatalogCategory(names);
      store.catalogCategories = [...current, created];
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "catalog-category",
        entityId: created.id,
        detail: names.en || names.ar || names.he,
      });
      return store;
    });

    return NextResponse.json({ category: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "LIMIT") {
      return jsonError("Too many categories", 400);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as {
      id?: string;
      names?: unknown;
      showInMainCatalog?: boolean;
    };
    const id = body.id?.trim();
    if (!id) return jsonError("Category id is required", 400);

    let updated: CatalogCategory | null = null;
    await updateStore((store) => {
      const current = mergeCatalogCategories(store.catalogCategories);
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      const existing = current[index];
      const names = sanitizeCategoryNames(body.names, existing.names);
      if (!namesHaveContent(names)) throw new Error("INVALID");
      updated = {
        ...existing,
        id: existing.id,
        system: isSystemCategoryId(existing.id) || existing.system,
        names,
        showInMainCatalog:
          typeof body.showInMainCatalog === "boolean"
            ? body.showInMainCatalog
            : existing.showInMainCatalog,
        updatedAt: new Date().toISOString(),
      };
      const next = [...current];
      next[index] = updated;
      store.catalogCategories = next;
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "catalog-category",
        entityId: updated.id,
        detail: names.en || names.ar || names.he,
      });
      return store;
    });

    return NextResponse.json({ category: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Category not found", 404);
    }
    if (error instanceof Error && error.message === "INVALID") {
      return jsonError("Category name is required", 400);
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("inventory");
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id")?.trim() || "";
    let removeMemberships = searchParams.get("removeMemberships") === "1";
    let reassignTo = searchParams.get("reassignTo")?.trim() || "";

    if (!id) {
      try {
        const body = (await request.json()) as {
          id?: string;
          removeMemberships?: boolean;
          reassignTo?: string;
        };
        id = body.id?.trim() || "";
        removeMemberships = Boolean(body.removeMemberships);
        reassignTo = body.reassignTo?.trim() || "";
      } catch {
        /* no body */
      }
    }

    if (!id) return jsonError("Category id is required", 400);
    if (isSystemCategoryId(id) || (SYSTEM_CATEGORY_IDS as readonly string[]).includes(id)) {
      return jsonError("System categories cannot be deleted", 409);
    }

    await updateStore((store) => {
      const current = mergeCatalogCategories(store.catalogCategories);
      const next = applyCategoryDelete(current, store.products, id, {
        removeMemberships,
        reassignTo,
      });
      store.products = next.products;
      store.catalogCategories = next.categories;
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "catalog-category",
        entityId: id,
        detail: reassignTo ? `reassigned:${reassignTo}` : "removed-memberships",
      });
      return store;
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Category not found", 404);
    }
    if (error instanceof Error && error.message === "SYSTEM") {
      return jsonError("System categories cannot be deleted", 409);
    }
    if (error instanceof Error && error.message === "HAS_PRODUCTS") {
      return jsonError("Category has assigned products", 409, { code: "HAS_PRODUCTS" });
    }
    if (error instanceof Error && error.message === "INVALID_TARGET") {
      return jsonError("Invalid reassignment target", 400);
    }
    return handleRouteError(error);
  }
}

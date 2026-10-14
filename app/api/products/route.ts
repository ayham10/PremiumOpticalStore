import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import { mergeBookingMessages } from "@/lib/booking-messages";
import {
  mergeCategoryDefaultImages,
  storefrontProductImages,
} from "@/lib/product-images";
import {
  filterProductsForRequest,
  isProductType,
  mergeCatalogCategories,
  productCatalogIds,
  publicCatalogCategories,
  publicProductCategoryIds,
  sanitizeCategoryIds,
  toPublicCategory,
} from "@/lib/catalog-categories";
import { sanitizeBarcode, sanitizeFrameSize, sanitizeProductColor } from "@/lib/product-fields";
import {
  ensureProductNumbers,
  resolveProductNumber,
  uniqueProductSlug,
} from "@/lib/product-number";
import { productDiscountedPrice } from "@/lib/promotions";
import type {
  CatalogCategory,
  CategoryDefaultImages,
  Product,
  ProductStatus,
  Promotion,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** Card/list DTO — omit gallery, costs, and inventory fields. */
function withCatalogPrice(p: Product, promotions: Promotion[]): Product {
  const discountedPrice = productDiscountedPrice(p, promotions);
  if (discountedPrice == null) {
    const { discountedPrice: _drop, ...rest } = p;
    return rest;
  }
  return { ...p, discountedPrice };
}

function toListProduct(
  p: Product,
  defaults?: CategoryDefaultImages,
  catalogCategories?: CatalogCategory[],
  promotions: Promotion[] = [],
) {
  const images = storefrontProductImages(p, defaults);
  const priced = withCatalogPrice(p, promotions);
  return {
    id: priced.id,
    slug: priced.slug,
    name: priced.name,
    brand: priced.brand,
    sellingPrice: priced.sellingPrice,
    discountedPrice: priced.discountedPrice,
    status: priced.status,
    category: priced.category,
    categoryIds: catalogCategories
      ? publicProductCategoryIds(priced, catalogCategories)
      : productCatalogIds(priced),
    createdAt: priced.createdAt,
    featured: priced.featured,
    images: images[0] ? [images[0]] : [],
    ...(priced.lensType ? { lensType: priced.lensType } : {}),
    ...(priced.color ? { color: priced.color } : {}),
    ...(priced.frameSize ? { frameSize: priced.frameSize } : {}),
  };
}

function toPublicProduct(
  p: Product,
  defaults?: CategoryDefaultImages,
  catalogCategories?: CatalogCategory[],
  promotions: Promotion[] = [],
): Product {
  const priced = withCatalogPrice(p, promotions);
  return {
    ...priced,
    images: storefrontProductImages(priced, defaults),
    categoryIds: catalogCategories
      ? publicProductCategoryIds(priced, catalogCategories)
      : productCatalogIds(priced),
  };
}

function sanitizeProductInput(
  input: Partial<Product>,
  existing?: Product,
  knownCategoryIds?: Set<string>,
): Omit<Product, "id" | "createdAt" | "updatedAt"> | null {
  const name = (input.name ?? existing?.name)?.trim();
  const brand = (input.brand ?? existing?.brand ?? "").trim();
  const category = input.category ?? existing?.category;
  const description = (input.description ?? existing?.description ?? "").trim();
  const skuRaw = (input.sku ?? existing?.sku)?.trim() || "";

  if (!name || !category || !isProductType(category)) {
    return null;
  }

  const frameSizeRaw = input.frameSize !== undefined ? input.frameSize : existing?.frameSize;
  if (typeof frameSizeRaw === "string" && frameSizeRaw.trim()) {
    if (sanitizeFrameSize(frameSizeRaw) == null) return null;
  }

  const sellingPrice = Number(input.sellingPrice ?? existing?.sellingPrice ?? 0);
  const purchasePrice = Number(input.purchasePrice ?? existing?.purchasePrice ?? 0);
  const stockQuantity = Number(input.stockQuantity ?? existing?.stockQuantity ?? 0);
  const minimumStock = Number(input.minimumStock ?? existing?.minimumStock ?? 0);
  const wholeStock = Number.isFinite(stockQuantity)
    ? Math.max(0, Math.floor(stockQuantity))
    : 0;
  const wholeMinimum = Number.isFinite(minimumStock)
    ? Math.max(0, Math.floor(minimumStock))
    : 0;
  const status = (input.status ?? existing?.status ?? "active") as ProductStatus;

  return {
    slug: existing?.slug || "",
    name,
    category,
    brand,
    frameType: input.frameType ?? existing?.frameType,
    lensType: input.lensType ?? existing?.lensType,
    barcode: sanitizeBarcode(
      input.barcode !== undefined ? input.barcode : existing?.barcode,
    ),
    sku: skuRaw,
    color: sanitizeProductColor(
      input.color !== undefined ? input.color : existing?.color,
    ),
    frameSize: sanitizeFrameSize(
      input.frameSize !== undefined ? input.frameSize : existing?.frameSize,
    ),
    description,
    images: Array.isArray(input.images)
      ? input.images.filter((u): u is string => typeof u === "string")
      : existing?.images ?? [],
    purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    stockQuantity: wholeStock,
    minimumStock: wholeMinimum,
    supplierId: input.supplierId ?? existing?.supplierId,
    status,
    featured: Boolean(input.featured ?? existing?.featured ?? false),
    categoryIds: knownCategoryIds
      ? sanitizeCategoryIds(
          input.categoryIds !== undefined ? input.categoryIds : existing?.categoryIds,
          knownCategoryIds,
          category,
        )
      : sanitizeCategoryIds(existing?.categoryIds, new Set(), category),
  };
}

function syncSpecificPromotions(
  promotions: Promotion[],
  productId: string,
  promotionIds: string[] | undefined,
): Promotion[] {
  if (!promotionIds) return promotions;
  const wanted = new Set(promotionIds);
  const now = new Date().toISOString();
  return promotions.map((promo) => {
    if ((promo.scope || "all") !== "specific") return promo;
    const has = (promo.productIds || []).includes(productId);
    const should = wanted.has(promo.id);
    if (has === should) return promo;
    const productIds = should
      ? [...(promo.productIds || []), productId]
      : (promo.productIds || []).filter((id) => id !== productId);
    return { ...promo, productIds, updatedAt: now };
  });
}

function finishProductFields(
  fields: Omit<Product, "id" | "createdAt" | "updatedAt">,
  products: Product[],
  excludeId: string | undefined,
  reallocateIfTaken: boolean,
): Omit<Product, "id" | "createdAt" | "updatedAt"> {
  const sku = resolveProductNumber(
    fields.sku,
    products,
    excludeId,
    reallocateIfTaken || !fields.sku.trim(),
  );
  const slug = uniqueProductSlug(
    fields.name,
    products,
    excludeId,
    fields.slug || undefined,
  );
  const { discountedPrice: _drop, ...rest } = { ...fields, sku, slug };
  return rest;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get("featured");
    const slug = searchParams.get("slug")?.trim() || "";
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const all = searchParams.get("all") === "1";
    const categoryParams = [
      ...searchParams.getAll("category"),
      ...(searchParams.get("categories")?.split(",") || []),
    ]
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    let { data } = await getStore();
    const catalogCategories = mergeCatalogCategories(data.catalogCategories);
    const needsProductNumbers = data.products.some((product) => !product.sku?.trim());
    if (all && needsProductNumbers) {
      try {
        await requireSession("inventory");
        const saved = await updateStore((store) => {
          store.products = ensureProductNumbers(store.products);
          return store;
        });
        data = saved.data;
      } catch {
        data.products = ensureProductNumbers(data.products);
      }
    } else {
      data.products = ensureProductNumbers(data.products);
    }
    const defaults = mergeCategoryDefaultImages(
      data.settings?.categoryDefaultImages,
    );
    let products = data.products;
    let fullRecords = all;

    // Public listing defaults to active products; admins with inventory can request all
    if (!all) {
      products = products.filter((p) => p.status === "active" || p.status === "out_of_stock");
    } else {
      try {
        await requireSession("inventory");
      } catch {
        products = products.filter((p) => p.status === "active" || p.status === "out_of_stock");
        fullRecords = false;
      }
    }

    if (featured === "1" || featured === "true") {
      products = products.filter((p) => p.featured);
    }

    if (slug) {
      const product =
        products.find(
          (p) => p.slug?.trim() === slug || p.id === slug,
        ) || null;
      const related = product
        ? products
            .filter(
              (p) =>
                p.id !== product.id &&
                p.category === product.category &&
                (p.status === "active" || p.status === "out_of_stock"),
            )
            .slice(0, 8)
            .map((p) => toListProduct(p, defaults, catalogCategories, data.promotions))
        : [];
      const publicProduct = product
        ? toPublicProduct(product, defaults, catalogCategories, data.promotions)
        : null;
      return NextResponse.json(
        {
          product: publicProduct,
          related,
          products: publicProduct ? [publicProduct] : [],
          settings: {
            whatsapp: mergeBookingMessages(data.settings.bookingMessages)
              .ownerNotification.ownerWhatsApp,
            currencySymbol: data.settings.currencySymbol,
            currency: data.settings.currency,
            categoryDefaultImages: defaults,
          },
        },
        {
          headers: {
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          },
        },
      );
    }

    if (featured !== "1" && featured !== "true") {
      products = filterProductsForRequest({
        products,
        categories: catalogCategories,
        requestedCategoryIds: categoryParams,
        admin: fullRecords,
      });
    } else if (categoryParams.length > 0) {
      products = filterProductsForRequest({
        products,
        categories: catalogCategories,
        requestedCategoryIds: categoryParams,
        admin: fullRecords,
      });
    }

    if (q) {
      products = products.filter((p) =>
        [
          p.name,
          p.brand,
          p.sku,
          p.barcode,
          p.color,
          p.frameSize,
          p.description,
          p.category,
          ...(p.categoryIds || []),
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }

    // Admin inventory (`all=1` + session) needs full product records; public lists get cards only.
    const numbered = ensureProductNumbers(products);
    const payload = fullRecords
      ? numbered.map((p) => withCatalogPrice(p, data.promotions))
      : numbered.map((p) => toListProduct(p, defaults, catalogCategories, data.promotions));

    return NextResponse.json(
      {
        products: payload,
        ...(fullRecords
          ? { catalogCategories }
          : {
              categoryDefaultImages: defaults,
              catalogCategories: publicCatalogCategories(catalogCategories).map(
                (item) => toPublicCategory(item, searchParams.get("locale") || "ar"),
              ),
            }),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as Partial<Product> & {
      skuManual?: boolean;
      promotionIds?: string[];
    };
    const { data: current } = await getStore();
    const knownIds = new Set(
      mergeCatalogCategories(current.catalogCategories).map((item) => item.id),
    );
    const fields = sanitizeProductInput(body, undefined, knownIds);
    if (!fields) {
      return jsonError("Invalid product payload", 400);
    }

    const now = new Date().toISOString();
    const productId = newId("prod");

    const { data } = await updateStore((store) => {
      store.products = ensureProductNumbers(store.products);
      let finished: Omit<Product, "id" | "createdAt" | "updatedAt">;
      try {
        finished = finishProductFields(
          fields,
          store.products,
          undefined,
          body.skuManual !== true,
        );
      } catch (error) {
        if (error instanceof Error && error.message === "PRODUCT_NUMBER_TAKEN") {
          throw error;
        }
        throw error;
      }
      const product: Product = {
        id: productId,
        ...finished,
        createdAt: now,
        updatedAt: now,
      };
      store.products.unshift(product);
      store.promotions = syncSpecificPromotions(
        store.promotions,
        product.id,
        body.promotionIds,
      );
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
      { product: data.products.find((p) => p.id === productId) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NUMBER_TAKEN") {
      return jsonError("رقم المنتج مستخدم بالفعل", 409);
    }
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as Partial<Product> & {
      id?: string;
      skuManual?: boolean;
      promotionIds?: string[];
    };

    if (!body.id) {
      return jsonError("Product id is required", 400);
    }

    let updated: Product | null = null;

    await updateStore((store) => {
      store.products = ensureProductNumbers(store.products);
      const index = store.products.findIndex((p) => p.id === body.id);
      if (index < 0) throw new Error("NOT_FOUND");

      const knownIds = new Set(
        mergeCatalogCategories(store.catalogCategories).map((item) => item.id),
      );
      const fields = sanitizeProductInput(body, store.products[index], knownIds);
      if (!fields) throw new Error("INVALID");

      let finished: Omit<Product, "id" | "createdAt" | "updatedAt">;
      try {
        finished = finishProductFields(
          { ...fields, slug: store.products[index].slug },
          store.products,
          body.id,
          body.skuManual !== true,
        );
      } catch (error) {
        if (error instanceof Error && error.message === "PRODUCT_NUMBER_TAKEN") {
          throw new Error("CONFLICT");
        }
        throw error;
      }

      updated = {
        ...store.products[index],
        ...finished,
        id: store.products[index].id,
        createdAt: store.products[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.products[index] = updated;
      store.promotions = syncSpecificPromotions(
        store.promotions,
        updated.id,
        body.promotionIds,
      );

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
        return jsonError("رقم المنتج مستخدم بالفعل", 409);
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
      store.promotions = store.promotions.map((promo) => {
        const productIds = (promo.productIds || []).filter((item) => item !== id);
        if (productIds.length === (promo.productIds || []).length) return promo;
        return { ...promo, productIds, updatedAt: new Date().toISOString() };
      });
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

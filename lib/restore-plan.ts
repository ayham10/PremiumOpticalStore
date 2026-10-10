import {
  isProductType,
  mergeCatalogCategories,
  productBelongsToCategory,
  productCatalogIds,
  sanitizeCategoryIds,
} from "@/lib/catalog-categories";
import { normalizeCustomServicePage } from "@/lib/custom-service-pages";
import {
  applyRestoreCategories,
  parseBackupId,
  parseRestoreCategories,
  restoreCategoryCount,
  unselectedFieldsMatch,
  type RestoreCategory,
} from "@/lib/restore-apply";
import type {
  AppData,
  CatalogCategory,
  CustomServicePage,
  Product,
} from "@/lib/types";

export const RESTORE_MODES = [
  "sections",
  "full",
  "customPage",
  "product",
  "categoryWithProducts",
  "rollback",
] as const;

export type RestoreMode = (typeof RESTORE_MODES)[number];

export type RestoreRequest =
  | {
      mode: "sections";
      backupId: string;
      categories: RestoreCategory[];
    }
  | {
      mode: "full";
      backupId: string;
    }
  | {
      mode: "customPage";
      backupId: string;
      pageId: string;
    }
  | {
      mode: "product";
      backupId: string;
      productId: string;
    }
  | {
      mode: "categoryWithProducts";
      backupId: string;
      categoryIds: string[];
    }
  | {
      mode: "rollback";
      backupId?: string;
    };

export type RestoreChangeAction = "add" | "update" | "unchanged";

export type RestoreChangeItem = {
  action: RestoreChangeAction;
  id: string;
  label: string;
  overwrite: boolean;
};

export type RestoreMediaForecast = {
  referenced: number;
  alreadyPresent: number;
  willRestore: number;
  missing: number;
};

export type RestorePreviewDetails = {
  mode: RestoreMode;
  warning: "sections" | "full" | "page" | "product" | "category" | "rollback";
  pages?: RestoreChangeItem[];
  products?: RestoreChangeItem[];
  categories?: RestoreChangeItem[];
  overwriteProductIds?: string[];
  droppedMemberships?: number;
  replacedFields?: string[];
};

function asId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isRestoreMode(value: unknown): value is RestoreMode {
  return typeof value === "string" && (RESTORE_MODES as readonly string[]).includes(value);
}

export function parseSnapshotId(
  value: unknown,
): { kind: "daily" | "manual" | "pre-restore"; createdAt: string } {
  if (typeof value !== "string" || !value.includes(":")) {
    throw new Error("RESTORE_BACKUP_INVALID");
  }
  const sep = value.indexOf(":");
  const kind = value.slice(0, sep);
  const createdAt = value.slice(sep + 1);
  if (
    (kind !== "daily" && kind !== "manual" && kind !== "pre-restore") ||
    !createdAt ||
    Number.isNaN(new Date(createdAt).getTime())
  ) {
    throw new Error("RESTORE_BACKUP_INVALID");
  }
  return { kind, createdAt };
}

export function snapshotHistoryId(
  kind: "daily" | "manual" | "pre-restore",
  createdAt: string,
): string {
  return `${kind}:${createdAt}`;
}

export function validateRestorableAppData(data: unknown): AppData {
  if (!data || typeof data !== "object") {
    throw new Error("RESTORE_BACKUP_INCOMPLETE");
  }
  const app = data as AppData;
  if (!Array.isArray(app.products)) {
    throw new Error("RESTORE_BACKUP_INCOMPATIBLE");
  }
  if (!app.settings || typeof app.settings !== "object") {
    throw new Error("RESTORE_BACKUP_INCOMPATIBLE");
  }
  return app;
}

export function parseRestoreRequest(body: unknown): RestoreRequest {
  if (!body || typeof body !== "object") {
    throw new Error("RESTORE_REQUEST_INVALID");
  }
  const rec = body as Record<string, unknown>;
  const rawMode = rec.mode;
  const mode: RestoreMode | undefined = isRestoreMode(rawMode)
    ? rawMode
    : rec.categories !== undefined
      ? "sections"
      : undefined;
  if (!mode) {
    throw new Error("RESTORE_MODE_REQUIRED");
  }

  if (mode === "rollback") {
    if (rec.backupId == null || rec.backupId === "") {
      return { mode: "rollback" };
    }
    const parsed = parseSnapshotId(rec.backupId);
    if (parsed.kind !== "pre-restore") {
      throw new Error("RESTORE_BACKUP_INVALID");
    }
    return {
      mode: "rollback",
      backupId: snapshotHistoryId(parsed.kind, parsed.createdAt),
    };
  }

  const parsed = parseSnapshotId(rec.backupId);
  if (parsed.kind === "pre-restore") {
    throw new Error("RESTORE_BACKUP_INVALID");
  }
  const backupId = snapshotHistoryId(parsed.kind, parsed.createdAt);

  if (mode === "full") {
    return { mode: "full", backupId };
  }
  if (mode === "sections") {
    return {
      mode: "sections",
      backupId,
      categories: parseRestoreCategories(rec.categories),
    };
  }
  if (mode === "customPage") {
    const pageId = asId(rec.pageId);
    if (!pageId) throw new Error("RESTORE_PAGE_REQUIRED");
    return { mode: "customPage", backupId, pageId };
  }
  if (mode === "product") {
    const productId = asId(rec.productId);
    if (!productId) throw new Error("RESTORE_PRODUCT_REQUIRED");
    return { mode: "product", backupId, productId };
  }
  const categoryIds = Array.isArray(rec.categoryIds)
    ? [...new Set(rec.categoryIds.map(asId).filter(Boolean))]
    : [];
  if (!categoryIds.length) throw new Error("RESTORE_CATEGORY_IDS_REQUIRED");
  return { mode: "categoryWithProducts", backupId, categoryIds };
}

export function customPagesOf(data: AppData): CustomServicePage[] {
  const raw = data.settings?.servicePages?.customPages;
  return Array.isArray(raw) ? raw : [];
}

function pageLabel(page: CustomServicePage): string {
  return (
    page.name?.trim() ||
    page.locales?.ar?.title?.trim() ||
    page.locales?.en?.title?.trim() ||
    page.slug ||
    page.id
  );
}

function productLabel(product: Product): string {
  return product.name?.trim() || product.sku || product.id;
}

function categoryLabel(category: CatalogCategory): string {
  return (
    category.names?.ar?.trim() ||
    category.names?.en?.trim() ||
    category.names?.he?.trim() ||
    category.id
  );
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((row) => row.id === item.id);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

function changeFor<T extends { id: string }>(
  live: T | undefined,
  incoming: T,
  label: string,
): RestoreChangeItem {
  if (!live) {
    return { action: "add", id: incoming.id, label, overwrite: false };
  }
  const same = JSON.stringify(live) === JSON.stringify(incoming);
  return {
    action: same ? "unchanged" : "update",
    id: incoming.id,
    label,
    overwrite: !same,
  };
}

export function knownCategoryIdSet(categories: CatalogCategory[]): Set<string> {
  return new Set(categories.map((item) => item.id));
}

export function sanitizeRestoredProduct(
  product: Product,
  knownIds: Set<string>,
): { product: Product; dropped: number } {
  const type = isProductType(product.category) ? product.category : product.category;
  const before = productCatalogIds(product);
  const extras = isProductType(type)
    ? sanitizeCategoryIds(product.categoryIds, knownIds, type)
    : uniqueExistingIds(product.categoryIds, knownIds).filter((id) => id !== type);
  const next: Product = {
    ...structuredClone(product),
    categoryIds: extras,
  };
  const after = productCatalogIds(next);
  const dropped = before.filter((id) => !after.includes(id)).length;
  return { product: next, dropped };
}

function uniqueExistingIds(raw: unknown, knownIds: Set<string>): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const id = asId(item);
    if (!id || seen.has(id) || !knownIds.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function withUpdatedSettingsPages(
  live: AppData,
  pages: CustomServicePage[],
): AppData {
  const next = structuredClone(live);
  next.settings = {
    ...next.settings,
    servicePages: {
      ...next.settings.servicePages,
      customPages: pages,
    } as AppData["settings"]["servicePages"],
  };
  return next;
}

export function applyCustomPageRestore(
  live: AppData,
  backup: AppData,
  pageId: string,
): { next: AppData; change: RestoreChangeItem } {
  const incomingRaw = customPagesOf(backup).find((page) => page.id === pageId);
  const incoming = incomingRaw ? normalizeCustomServicePage(incomingRaw) : null;
  if (!incoming) {
    throw new Error("RESTORE_PAGE_NOT_FOUND");
  }
  const livePages = customPagesOf(live);
  const existing = livePages.find((page) => page.id === pageId);
  const change = changeFor(existing, incoming, pageLabel(incoming));
  const nextPages = upsertById(livePages.map((page) => structuredClone(page)), incoming);
  return { next: withUpdatedSettingsPages(live, nextPages), change };
}

export function applyProductRestore(
  live: AppData,
  backup: AppData,
  productId: string,
): { next: AppData; change: RestoreChangeItem; dropped: number } {
  const incoming = (backup.products || []).find((item) => item.id === productId);
  if (!incoming) {
    throw new Error("RESTORE_PRODUCT_NOT_FOUND");
  }
  const known = knownCategoryIdSet(mergeCatalogCategories(live.catalogCategories));
  const sanitized = sanitizeRestoredProduct(incoming, known);
  const existing = (live.products || []).find((item) => item.id === productId);
  const change = changeFor(existing, sanitized.product, productLabel(sanitized.product));
  const next = structuredClone(live);
  next.products = upsertById(next.products || [], sanitized.product);
  return { next, change, dropped: sanitized.dropped };
}

export function applyCategoryWithProductsRestore(
  live: AppData,
  backup: AppData,
  categoryIds: string[],
): {
  next: AppData;
  categories: RestoreChangeItem[];
  products: RestoreChangeItem[];
  overwriteProductIds: string[];
  droppedMemberships: number;
} {
  const wanted = [...new Set(categoryIds.map(asId).filter(Boolean))];
  if (!wanted.length) throw new Error("RESTORE_CATEGORY_IDS_REQUIRED");

  const backupCategories = mergeCatalogCategories(backup.catalogCategories);
  const selectedCategories = backupCategories.filter((item) => wanted.includes(item.id));
  if (!selectedCategories.length) {
    throw new Error("RESTORE_CATEGORY_NOT_FOUND");
  }
  const backupProducts = (backup.products || []).filter((product) =>
    wanted.some((id) => productBelongsToCategory(product, id)),
  );

  const liveCategories = mergeCatalogCategories(live.catalogCategories);
  let mergedCategories = liveCategories.map((item) => structuredClone(item));
  const categoryChanges: RestoreChangeItem[] = [];
  for (const incoming of selectedCategories) {
    const existing = mergedCategories.find((item) => item.id === incoming.id);
    categoryChanges.push(changeFor(existing, incoming, categoryLabel(incoming)));
    mergedCategories = upsertById(mergedCategories, structuredClone(incoming));
  }
  const known = knownCategoryIdSet(mergedCategories);

  let droppedMemberships = 0;
  const productChanges: RestoreChangeItem[] = [];
  const overwriteProductIds: string[] = [];
  let mergedProducts = (live.products || []).map((item) => structuredClone(item));
  for (const incoming of backupProducts) {
    const sanitized = sanitizeRestoredProduct(incoming, known);
    droppedMemberships += sanitized.dropped;
    const nextProduct: Product = sanitized.product;
    const existing = mergedProducts.find((item) => item.id === nextProduct.id);
    const change = changeFor(existing, nextProduct, productLabel(nextProduct));
    productChanges.push(change);
    if (change.overwrite) overwriteProductIds.push(nextProduct.id);
    mergedProducts = upsertById(mergedProducts, nextProduct);
  }

  const next = structuredClone(live);
  next.catalogCategories = mergedCategories;
  next.products = mergedProducts;
  return {
    next,
    categories: categoryChanges,
    products: productChanges,
    overwriteProductIds,
    droppedMemberships,
  };
}

export function applyFullRestore(live: AppData, backup: AppData): AppData {
  const next = structuredClone(backup);
  next.version = live.version || backup.version || 1;
  return next;
}

export function applyRestorePlan(
  live: AppData,
  backup: AppData,
  request: RestoreRequest,
): { next: AppData; details: RestorePreviewDetails } {
  if (request.mode === "rollback" || request.mode === "full") {
    return {
      next: applyFullRestore(live, backup),
      details: {
        mode: request.mode,
        warning: request.mode,
        replacedFields: [
          "bookings",
          "products",
          "catalogCategories",
          "lenses",
          "settings",
          "promotions",
          "media",
          "customers",
          "availability",
        ],
      },
    };
  }
  if (request.mode === "sections") {
    return {
      next: applyRestoreCategories(live, backup, request.categories),
      details: { mode: "sections", warning: "sections" },
    };
  }
  if (request.mode === "customPage") {
    const result = applyCustomPageRestore(live, backup, request.pageId);
    return {
      next: result.next,
      details: {
        mode: "customPage",
        warning: "page",
        pages: [result.change],
      },
    };
  }
  if (request.mode === "product") {
    const result = applyProductRestore(live, backup, request.productId);
    return {
      next: result.next,
      details: {
        mode: "product",
        warning: "product",
        products: [result.change],
        overwriteProductIds: result.change.overwrite ? [result.change.id] : [],
        droppedMemberships: result.dropped,
      },
    };
  }
  const result = applyCategoryWithProductsRestore(live, backup, request.categoryIds);
  return {
    next: result.next,
    details: {
      mode: "categoryWithProducts",
      warning: "category",
      categories: result.categories,
      products: result.products,
      overwriteProductIds: result.overwriteProductIds,
      droppedMemberships: result.droppedMemberships,
    },
  };
}

export function collectRestoreMediaSource(
  _live: AppData,
  backup: AppData,
  request: RestoreRequest,
  next: AppData,
): unknown {
  if (request.mode === "full" || request.mode === "rollback") {
    return backup;
  }
  if (request.mode === "sections") {
    const subset: Partial<AppData> = {};
    if (request.categories.includes("products")) {
      subset.products = next.products;
      subset.catalogCategories = next.catalogCategories;
    }
    if (request.categories.includes("settings")) subset.settings = next.settings;
    if (request.categories.includes("promotions")) subset.promotions = next.promotions;
    if (request.categories.includes("lenses")) subset.lensInventory = next.lensInventory;
    return subset;
  }
  if (request.mode === "customPage") {
    return {
      settings: {
        servicePages: {
          customPages: customPagesOf(next).filter(
            (page) => page.id === request.pageId,
          ),
        },
      },
    };
  }
  if (request.mode === "product") {
    return {
      products: (next.products || []).filter((item) => item.id === request.productId),
    };
  }
  return {
    catalogCategories: resultCategories(next, request.categoryIds),
    products: (next.products || []).filter((product) =>
      request.categoryIds.some((id) => productBelongsToCategory(product, id)),
    ),
  };
}

function resultCategories(data: AppData, ids: string[]): CatalogCategory[] {
  const set = new Set(ids);
  return mergeCatalogCategories(data.catalogCategories).filter((item) => set.has(item.id));
}

export function sectionPreviewRows(
  live: AppData,
  backup: AppData,
  request: RestoreRequest,
): Array<{ key: string; liveCount: number; backupCount: number }> {
  if (request.mode === "sections") {
    return request.categories.map((category) => ({
      key: category,
      liveCount: restoreCategoryCount(live, category),
      backupCount: restoreCategoryCount(backup, category),
    }));
  }
  if (request.mode === "full" || request.mode === "rollback") {
    return [
      {
        key: "bookings",
        liveCount: restoreCategoryCount(live, "bookings"),
        backupCount: restoreCategoryCount(backup, "bookings"),
      },
      {
        key: "products",
        liveCount: restoreCategoryCount(live, "products"),
        backupCount: restoreCategoryCount(backup, "products"),
      },
      {
        key: "lenses",
        liveCount: restoreCategoryCount(live, "lenses"),
        backupCount: restoreCategoryCount(backup, "lenses"),
      },
      {
        key: "settings",
        liveCount: restoreCategoryCount(live, "settings"),
        backupCount: restoreCategoryCount(backup, "settings"),
      },
      {
        key: "promotions",
        liveCount: restoreCategoryCount(live, "promotions"),
        backupCount: restoreCategoryCount(backup, "promotions"),
      },
    ];
  }
  return [];
}

export function listSnapshotItems(backup: AppData): {
  pages: Array<{ id: string; name: string; slug: string; status: string }>;
  products: Array<{ id: string; name: string; sku: string; category: string }>;
  categories: Array<{
    id: string;
    name: string;
    names: CatalogCategory["names"];
    showInMainCatalog: boolean;
    system: boolean;
    productCount: number;
  }>;
} {
  const categories = mergeCatalogCategories(backup.catalogCategories);
  return {
    pages: customPagesOf(backup).map((page) => ({
      id: page.id,
      name: pageLabel(page),
      slug: page.slug,
      status: page.status,
    })),
    products: (backup.products || []).map((product) => ({
      id: product.id,
      name: productLabel(product),
      sku: product.sku || "",
      category: String(product.category || ""),
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: categoryLabel(category),
      names: category.names,
      showInMainCatalog: category.showInMainCatalog === true,
      system: category.system === true || isProductType(category.id),
      productCount: (backup.products || []).filter((product) =>
        productBelongsToCategory(product, category.id),
      ).length,
    })),
  };
}

export function unchangedOutsidePlan(
  before: AppData,
  after: AppData,
  request: RestoreRequest,
): boolean {
  if (request.mode === "full" || request.mode === "rollback") return true;
  if (request.mode === "sections") {
    return unselectedFieldsMatch(before, after, request.categories);
  }
  if (request.mode === "customPage") {
    return (
      JSON.stringify({ ...before, settings: null, updatedAt: null }) ===
        JSON.stringify({ ...after, settings: null, updatedAt: null }) &&
      JSON.stringify({ ...before.settings, servicePages: null }) ===
        JSON.stringify({ ...after.settings, servicePages: null }) &&
      customPagesOf(before)
        .filter((page) => page.id !== request.pageId)
        .every((page) => {
          const next = customPagesOf(after).find((item) => item.id === page.id);
          return next && JSON.stringify(next) === JSON.stringify(page);
        })
    );
  }
  if (request.mode === "product") {
    const beforeOthers = (before.products || []).filter((item) => item.id !== request.productId);
    const afterOthers = (after.products || []).filter((item) => item.id !== request.productId);
    return (
      JSON.stringify(beforeOthers) === JSON.stringify(afterOthers) &&
      JSON.stringify({ ...before, products: null, updatedAt: null }) ===
        JSON.stringify({ ...after, products: null, updatedAt: null })
    );
  }
  const selected = new Set(request.categoryIds);
  const restoredProductIds = new Set(
    (after.products || [])
      .filter((product) =>
        request.categoryIds.some((id) => productBelongsToCategory(product, id)),
      )
      .map((product) => product.id),
  );
  const beforeUnrelatedProducts = (before.products || []).filter(
    (product) => !restoredProductIds.has(product.id),
  );
  const afterUnrelatedProducts = (after.products || []).filter(
    (product) => !restoredProductIds.has(product.id),
  );
  const beforeUnrelatedCategories = mergeCatalogCategories(before.catalogCategories).filter(
    (item) => !selected.has(item.id),
  );
  const afterUnrelatedCategories = mergeCatalogCategories(after.catalogCategories).filter(
    (item) => !selected.has(item.id),
  );
  return (
    JSON.stringify(beforeUnrelatedProducts) === JSON.stringify(afterUnrelatedProducts) &&
    JSON.stringify(beforeUnrelatedCategories) === JSON.stringify(afterUnrelatedCategories) &&
    JSON.stringify({
      ...before,
      products: null,
      catalogCategories: null,
      updatedAt: null,
    }) ===
      JSON.stringify({
        ...after,
        products: null,
        catalogCategories: null,
        updatedAt: null,
      })
  );
}

/** Existing callers still parse daily/manual ids only. */
export { parseBackupId, parseRestoreCategories };

import type { AppData } from "./types";

export const RESTORE_CATEGORIES = [
  "bookings",
  "products",
  "lenses",
  "settings",
  "promotions",
] as const;

export type RestoreCategory = (typeof RESTORE_CATEGORIES)[number];

/**
 * Inspected AppData keys for each Admin restore category.
 * Bookings = clinic booking records (`eyeExamAppointments`) plus the
 * still-stored legacy `appointments` array. Stock lives on `products`.
 * Site content lives on `settings` (`servicePages`, branding, hours, …).
 */
export const RESTORE_CATEGORY_FIELDS = {
  bookings: ["eyeExamAppointments", "appointments"],
  products: ["products", "catalogCategories"],
  lenses: ["lensInventory"],
  settings: ["settings"],
  promotions: ["promotions"],
} as const satisfies Record<RestoreCategory, readonly (keyof AppData)[]>;

export type RestoreAppDataField =
  (typeof RESTORE_CATEGORY_FIELDS)[RestoreCategory][number];

const CATEGORY_SET = new Set<string>(RESTORE_CATEGORIES);

export function isRestoreCategory(value: unknown): value is RestoreCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function parseRestoreCategories(value: unknown): RestoreCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("RESTORE_CATEGORIES_REQUIRED");
  }
  const unique: RestoreCategory[] = [];
  for (const item of value) {
    if (!isRestoreCategory(item)) {
      throw new Error("RESTORE_CATEGORY_INVALID");
    }
    if (!unique.includes(item)) unique.push(item);
  }
  return unique;
}

export function fieldsForCategories(
  categories: RestoreCategory[],
): RestoreAppDataField[] {
  const fields = new Set<RestoreAppDataField>();
  for (const category of categories) {
    for (const field of RESTORE_CATEGORY_FIELDS[category]) fields.add(field);
  }
  return [...fields];
}

export function restoreCategoryCount(
  data: AppData,
  category: RestoreCategory,
): number {
  if (category === "bookings") {
    return Array.isArray(data.eyeExamAppointments)
      ? data.eyeExamAppointments.length
      : 0;
  }
  if (category === "products") {
    return Array.isArray(data.products) ? data.products.length : 0;
  }
  if (category === "lenses") {
    return Array.isArray(data.lensInventory) ? data.lensInventory.length : 0;
  }
  if (category === "promotions") {
    return Array.isArray(data.promotions) ? data.promotions.length : 0;
  }
  return data.settings && typeof data.settings === "object"
    ? Object.keys(data.settings).length
    : 0;
}

export function parseBackupId(
  value: unknown,
): { kind: "daily" | "manual"; createdAt: string } {
  if (typeof value !== "string" || !value.includes(":")) {
    throw new Error("RESTORE_BACKUP_INVALID");
  }
  const sep = value.indexOf(":");
  const kind = value.slice(0, sep);
  const createdAt = value.slice(sep + 1);
  if (
    (kind !== "daily" && kind !== "manual") ||
    !createdAt ||
    Number.isNaN(new Date(createdAt).getTime())
  ) {
    throw new Error("RESTORE_BACKUP_INVALID");
  }
  return { kind, createdAt };
}

export function backupHistoryId(
  kind: "daily" | "manual",
  createdAt: string,
): string {
  return `${kind}:${createdAt}`;
}

export function applyRestoreCategories(
  live: AppData,
  backup: AppData,
  categories: RestoreCategory[],
): AppData {
  const parsed = parseRestoreCategories(categories);
  const next = structuredClone(live);
  for (const field of fieldsForCategories(parsed)) {
    if (backup[field] === undefined) {
      throw new Error(`RESTORE_FIELD_MISSING:${String(field)}`);
    }
    if (field === "eyeExamAppointments") {
      next.eyeExamAppointments = structuredClone(backup.eyeExamAppointments);
    } else if (field === "appointments") {
      next.appointments = structuredClone(backup.appointments);
    } else if (field === "products") {
      next.products = structuredClone(backup.products);
    } else if (field === "lensInventory") {
      next.lensInventory = structuredClone(backup.lensInventory);
    } else if (field === "settings") {
      next.settings = structuredClone(backup.settings);
    } else if (field === "promotions") {
      next.promotions = structuredClone(backup.promotions);
    }
  }
  return next;
}

export function unselectedFieldsMatch(
  before: AppData,
  after: AppData,
  categories: RestoreCategory[],
): boolean {
  const changed = new Set<string>(fieldsForCategories(categories));
  for (const key of Object.keys(before) as Array<keyof AppData>) {
    if (changed.has(String(key))) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return false;
  }
  return true;
}

import assert from "node:assert/strict";
import { hasPermission } from "../lib/auth";
import {
  applyCategoryDelete,
  categoryLabel,
  createCatalogCategory,
  filterProductsForRequest,
  isSystemCategoryId,
  mergeCatalogCategories,
  productBelongsToCategory,
  productCatalogIds,
  productVisibleInMainCatalog,
  publicProductCategoryIds,
  sanitizeCategoryIds,
  sanitizeCategoryName,
  sanitizeCategoryNames,
  SYSTEM_CATEGORY_NAMES,
} from "../lib/catalog-categories";
import type { CatalogCategory, Product } from "../lib/types";

function product(partial: Partial<Product> & Pick<Product, "id" | "category">): Product {
  return {
    slug: partial.id,
    name: partial.name || partial.id,
    brand: "OYON",
    sku: partial.id,
    description: "",
    images: [],
    purchasePrice: 1,
    sellingPrice: 10,
    stockQuantity: 2,
    minimumStock: 1,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function custom(
  id: string,
  showInMainCatalog: boolean,
  names?: Partial<CatalogCategory["names"]>,
): CatalogCategory {
  return {
    id,
    names: {
      ar: names?.ar || "مجموعة فاخرة",
      he: names?.he || "קולקציית יוקרה",
      en: names?.en || "Luxury Collection",
    },
    showInMainCatalog,
    system: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const created = createCatalogCategory({
  ar: "وصل حديثاً",
  he: "חדשים",
  en: "New Arrivals",
});
assert.match(created.id, /^cat_[a-f0-9]{16}$/);
assert.equal(created.showInMainCatalog, false);
assert.equal(created.system, false);
assert.equal(created.names.ar, "وصل حديثاً");
assert.equal(created.names.he, "חדשים");
assert.equal(created.names.en, "New Arrivals");

const hiddenByDefault = createCatalogCategory({ ar: "مسودة", he: "", en: "" });
assert.equal(hiddenByDefault.showInMainCatalog, false);

const merged = mergeCatalogCategories([
  {
    id: "Sunglasses",
    names: { ar: "", he: "", en: "Sunglasses" },
    showInMainCatalog: true,
    createdAt: "2019-01-01T00:00:00.000Z",
    updatedAt: "2019-01-01T00:00:00.000Z",
  },
  created,
]);
assert.equal(merged.filter((item) => item.id === "Sunglasses").length, 1);
const sunglasses = merged.find((item) => item.id === "Sunglasses");
assert.ok(sunglasses);
assert.equal(sunglasses.names.ar, SYSTEM_CATEGORY_NAMES.Sunglasses.ar);
assert.equal(sunglasses.names.he, SYSTEM_CATEGORY_NAMES.Sunglasses.he);
assert.equal(sunglasses.names.en, "Sunglasses");
assert.equal(sunglasses.showInMainCatalog, true);
assert.equal(sunglasses.system, true);
assert.ok(merged.some((item) => item.id === created.id));
assert.equal(mergeCatalogCategories(merged).length, merged.length);

const renamedId = sunglasses.id;
const renamed = {
  ...sunglasses,
  names: { ar: "شمسية مخصصة", he: sunglasses.names.he, en: "Custom Shades" },
};
const afterRename = mergeCatalogCategories([renamed, ...merged.filter((item) => item.id !== renamedId)]);
const still = afterRename.find((item) => item.id === renamedId);
assert.ok(still);
assert.equal(still.id, "Sunglasses");
assert.equal(still.names.ar, "شمسية مخصصة");
assert.equal(still.names.en, "Custom Shades");

const luxury = custom("cat_luxury", false);
const arrivals = custom("cat_new", true, { ar: "جديد", he: "חדש", en: "New Arrivals" });
const categories = mergeCatalogCategories([
  luxury,
  arrivals,
  {
    id: "Accessories",
    names: SYSTEM_CATEGORY_NAMES.Accessories,
    showInMainCatalog: false,
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]);

const frame = product({
  id: "p-frame",
  category: "Frames",
  categoryIds: ["cat_luxury", "cat_new"],
});
assert.deepEqual(productCatalogIds(frame), ["Frames", "cat_luxury", "cat_new"]);
assert.equal(productBelongsToCategory(frame, "Frames"), true);
assert.equal(productBelongsToCategory(frame, "cat_luxury"), true);
assert.equal(productBelongsToCategory(frame, "cat_new"), true);

const afterRemoveLuxury = {
  ...frame,
  categoryIds: sanitizeCategoryIds(
    ["cat_new", "Frames", "cat_new", "missing"],
    new Set(categories.map((item) => item.id)),
    "Frames",
  ),
};
assert.deepEqual(afterRemoveLuxury.categoryIds, ["cat_new"]);
assert.equal(productBelongsToCategory(afterRemoveLuxury, "cat_luxury"), false);
assert.equal(productBelongsToCategory(afterRemoveLuxury, "cat_new"), true);
assert.equal(productBelongsToCategory(afterRemoveLuxury, "Frames"), true);

const legacy = product({ id: "p-legacy", category: "Sunglasses" });
assert.deepEqual(productCatalogIds(legacy), ["Sunglasses"]);
assert.equal(productBelongsToCategory(legacy, "Sunglasses"), true);

const draft = product({ id: "p-draft", category: "Frames", status: "draft", categoryIds: ["cat_new"] });
const hiddenOnly = product({
  id: "p-hidden",
  category: "Accessories",
  categoryIds: ["cat_luxury"],
});
const publishedMulti = product({
  id: "p-multi",
  name: "Luxury Black Frame",
  category: "Frames",
  categoryIds: ["cat_luxury", "cat_new"],
});

const allProducts = [frame, legacy, draft, hiddenOnly, publishedMulti];

const adminLuxury = filterProductsForRequest({
  products: allProducts,
  categories,
  requestedCategoryIds: ["cat_luxury"],
  admin: true,
});
assert.deepEqual(
  adminLuxury.map((item) => item.id).sort(),
  ["p-frame", "p-hidden", "p-multi"],
);

const adminHiddenAndVisible = filterProductsForRequest({
  products: allProducts,
  categories,
  requestedCategoryIds: ["cat_new"],
  admin: true,
});
assert.ok(adminHiddenAndVisible.some((item) => item.id === "p-multi"));
assert.ok(adminHiddenAndVisible.some((item) => item.id === "p-frame"));

const publicAll = filterProductsForRequest({
  products: allProducts,
  categories,
  requestedCategoryIds: [],
  admin: false,
});
assert.deepEqual(publicAll.map((item) => item.id).sort(), ["p-frame", "p-legacy", "p-multi"]);
assert.equal(publicAll.filter((item) => item.id === "p-multi").length, 1);
assert.ok(!publicAll.some((item) => item.id === "p-hidden"));
assert.ok(!publicAll.some((item) => item.id === "p-draft"));

assert.equal(productVisibleInMainCatalog(publishedMulti, categories), true);
assert.equal(productVisibleInMainCatalog(hiddenOnly, categories), false);
assert.equal(productVisibleInMainCatalog(draft, categories), false);
assert.equal(productVisibleInMainCatalog(legacy, categories), true);

const publicLuxury = filterProductsForRequest({
  products: allProducts,
  categories,
  requestedCategoryIds: ["cat_luxury"],
  admin: false,
});
assert.deepEqual(publicLuxury, []);

const publicArrivals = filterProductsForRequest({
  products: allProducts,
  categories,
  requestedCategoryIds: ["cat_new"],
  admin: false,
});
assert.ok(publicArrivals.some((item) => item.id === "p-multi"));
assert.ok(publicArrivals.some((item) => item.id === "p-frame"));
assert.ok(!publicArrivals.some((item) => item.id === "p-hidden"));

const typePage = filterProductsForRequest({
  products: [
    product({ id: "sun", category: "Sunglasses", categoryIds: ["cat_luxury"] }),
    product({ id: "frame-extra", category: "Frames", categoryIds: ["Sunglasses"] }),
  ],
  categories,
  requestedCategoryIds: ["Sunglasses"],
  admin: false,
});
assert.deepEqual(typePage.map((item) => item.id), ["sun"]);

const shopAll = filterProductsForRequest({
  products: [publishedMulti, frame, legacy],
  categories,
  requestedCategoryIds: [],
  admin: false,
});
assert.equal(new Set(shopAll.map((item) => item.id)).size, shopAll.length);
assert.ok(shopAll.some((item) => item.id === "p-multi"));

assert.equal(categoryLabel(arrivals, "ar"), "جديد");
assert.equal(categoryLabel(arrivals, "he"), "חדש");
assert.equal(categoryLabel(arrivals, "en"), "New Arrivals");
assert.equal(categoryLabel({ id: "x", names: { ar: "", he: "", en: "" } }, "ar"), "x");

const stripped = sanitizeCategoryName('  <script>alert(1)</script>Luxury   Collection  ');
assert.equal(stripped.includes("<"), false);
assert.ok(stripped.includes("Luxury"));

const preserved = sanitizeCategoryNames({ ar: "", he: "", en: "" }, {
  ar: "محفوظ",
  he: "שמור",
  en: "Kept",
});
assert.deepEqual(preserved, { ar: "محفوظ", he: "שמור", en: "Kept" });

assert.equal(isSystemCategoryId("Sunglasses"), true);
assert.equal(isSystemCategoryId(created.id), false);
assert.throws(() => applyCategoryDelete(categories, allProducts, "Sunglasses", { removeMemberships: true }), /SYSTEM/);
assert.throws(() => applyCategoryDelete(categories, allProducts, "cat_luxury"), /HAS_PRODUCTS/);

const removed = applyCategoryDelete(categories, allProducts, "cat_luxury", {
  removeMemberships: true,
});
assert.ok(!removed.categories.some((item) => item.id === "cat_luxury"));
assert.equal(productBelongsToCategory(removed.products.find((item) => item.id === "p-multi")!, "cat_luxury"), false);
assert.equal(productBelongsToCategory(removed.products.find((item) => item.id === "p-multi")!, "cat_new"), true);
assert.equal(removed.products.find((item) => item.id === "p-multi")?.name, "Luxury Black Frame");
assert.equal(removed.products.find((item) => item.id === "p-multi")?.sellingPrice, 10);

const reassigned = applyCategoryDelete(categories, allProducts, "cat_luxury", {
  reassignTo: "cat_new",
});
assert.equal(productBelongsToCategory(reassigned.products.find((item) => item.id === "p-hidden")!, "cat_new"), true);
assert.equal(productBelongsToCategory(reassigned.products.find((item) => item.id === "p-hidden")!, "cat_luxury"), false);

assert.deepEqual(publicProductCategoryIds(publishedMulti, categories), ["Frames", "cat_new"]);

assert.equal(hasPermission("admin", "inventory"), true);
assert.equal(hasPermission("employee", "inventory"), true);
assert.equal(hasPermission("receptionist", "inventory"), false);

const enabled = { ...luxury, showInMainCatalog: true };
const disabled = { ...arrivals, showInMainCatalog: false };
const toggled = mergeCatalogCategories([enabled, disabled]);
assert.equal(toggled.find((item) => item.id === "cat_luxury")?.showInMainCatalog, true);
assert.equal(toggled.find((item) => item.id === "cat_new")?.showInMainCatalog, false);

console.log("catalog-categories tests passed");

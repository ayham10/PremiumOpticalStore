import assert from "node:assert/strict";
import { hasPermission } from "../lib/auth";
import {
  applyCategoryAssignments,
  applyCategoryDelete,
  assignedProductIdsForCategory,
  catalogCategorySaveMode,
  categoryLabel,
  categorySelectorGroups,
  countCategoryProducts,
  createCatalogCategory,
  filterProductsForRequest,
  isSystemCategoryId,
  mergeCatalogCategories,
  membershipIsProductType,
  productBelongsToCategory,
  productCatalogIds,
  productMatchesCategoryFilter,
  productVisibleInMainCatalog,
  publicEligibleAssignedCount,
  publicProductCategoryIds,
  sanitizeCategoryIds,
  sanitizeCategoryName,
  sanitizeCategoryNames,
  SYSTEM_CATEGORY_NAMES,
} from "../lib/catalog-categories";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
assert.equal(catalogCategorySaveMode(undefined), "create");
assert.equal(catalogCategorySaveMode(null), "create");
assert.equal(catalogCategorySaveMode(hiddenByDefault.id), "update");

const visibleOnCreate = createCatalogCategory(
  { ar: "ظاهرة", he: "", en: "Visible" },
  "2026-01-01T00:00:00.000Z",
  true,
);
assert.equal(visibleOnCreate.showInMainCatalog, true);

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
assert.equal(membershipIsProductType(legacy, "Sunglasses"), true);
assert.equal(membershipIsProductType(frame, "cat_luxury"), false);

const otherVisible = custom("cat_keep_visible", true);
const workflowHidden = createCatalogCategory({ ar: "مخفية", he: "", en: "Workflow Hidden" });
const afterCreateReload = mergeCatalogCategories([otherVisible, workflowHidden]);
assert.equal(afterCreateReload.find((item) => item.id === "cat_keep_visible")?.showInMainCatalog, true);
assert.equal(afterCreateReload.find((item) => item.id === workflowHidden.id)?.showInMainCatalog, false);

const assigned = applyCategoryAssignments(
  [frame, legacy, publishedMulti],
  workflowHidden.id,
  ["p-frame", "p-legacy"],
);
const assignedFrame = assigned.find((item) => item.id === "p-frame");
const assignedLegacy = assigned.find((item) => item.id === "p-legacy");
const untouchedMulti = assigned.find((item) => item.id === "p-multi");
assert.ok(assignedFrame && assignedLegacy && untouchedMulti);
assert.equal(productBelongsToCategory(assignedFrame, workflowHidden.id), true);
assert.equal(productBelongsToCategory(assignedLegacy, workflowHidden.id), true);
assert.equal(productBelongsToCategory(untouchedMulti, workflowHidden.id), false);
assert.equal(productBelongsToCategory(assignedFrame, "cat_luxury"), true);
assert.equal(productBelongsToCategory(assignedFrame, "cat_new"), true);
assert.equal(assignedFrame.category, "Frames");
assert.equal(assignedLegacy.category, "Sunglasses");
assert.equal(assignedFrame.sellingPrice, 10);
assert.equal(assignedFrame.stockQuantity, 2);
assert.deepEqual(assignedFrame.images, frame.images);
assert.equal(assigned.filter((item) => item.id === "p-frame").length, 1);

const retrySameSelection = applyCategoryAssignments(
  assigned,
  workflowHidden.id,
  ["p-frame", "p-legacy"],
);
assert.deepEqual(
  retrySameSelection.map((item) => item.categoryIds),
  assigned.map((item) => item.categoryIds),
);

const createdInWorkflow = product({
  id: "p-new-in-category",
  name: "New Category Frame",
  category: "Frames",
  categoryIds: [workflowHidden.id],
  sellingPrice: 42,
  images: ["/img/new.jpg"],
  stockQuantity: 7,
});
const afterNewProduct = applyCategoryAssignments(
  [...assigned, createdInWorkflow],
  workflowHidden.id,
  ["p-frame", "p-legacy", "p-new-in-category"],
);
assert.equal(afterNewProduct.filter((item) => item.id === "p-new-in-category").length, 1);
assert.equal(afterNewProduct.find((item) => item.id === "p-new-in-category")?.sellingPrice, 42);
assert.deepEqual(afterNewProduct.find((item) => item.id === "p-new-in-category")?.images, ["/img/new.jpg"]);
assert.equal(afterNewProduct.find((item) => item.id === "p-new-in-category")?.category, "Frames");

const removedExtra = applyCategoryAssignments(afterNewProduct, workflowHidden.id, ["p-legacy"]);
assert.equal(productBelongsToCategory(removedExtra.find((item) => item.id === "p-frame")!, workflowHidden.id), false);
assert.equal(productBelongsToCategory(removedExtra.find((item) => item.id === "p-legacy")!, workflowHidden.id), true);
assert.equal(productBelongsToCategory(removedExtra.find((item) => item.id === "p-new-in-category")!, workflowHidden.id), false);
assert.equal(productBelongsToCategory(removedExtra.find((item) => item.id === "p-frame")!, "cat_new"), true);
assert.equal(removedExtra.find((item) => item.id === "p-frame")?.category, "Frames");

const typeLocked = applyCategoryAssignments([legacy], "Sunglasses", []);
assert.equal(typeLocked[0].category, "Sunglasses");
assert.equal(productBelongsToCategory(typeLocked[0], "Sunglasses"), true);

const failedAssignThenRetry = applyCategoryAssignments([frame], workflowHidden.id, []);
assert.equal(productBelongsToCategory(failedAssignThenRetry[0], workflowHidden.id), false);
const recovered = applyCategoryAssignments(failedAssignThenRetry, workflowHidden.id, ["p-frame"]);
assert.equal(productBelongsToCategory(recovered[0], workflowHidden.id), true);
assert.equal(recovered[0].name, frame.name);

const enabledVisible = { ...workflowHidden, showInMainCatalog: true };
const afterVisibilityReload = mergeCatalogCategories([otherVisible, enabledVisible]);
assert.equal(afterVisibilityReload.find((item) => item.id === workflowHidden.id)?.showInMainCatalog, true);
assert.equal(afterVisibilityReload.find((item) => item.id === "cat_keep_visible")?.showInMainCatalog, true);

const enabled = { ...luxury, showInMainCatalog: true };
const disabled = { ...arrivals, showInMainCatalog: false };
const toggled = mergeCatalogCategories([enabled, disabled]);
assert.equal(toggled.find((item) => item.id === "cat_luxury")?.showInMainCatalog, true);
assert.equal(toggled.find((item) => item.id === "cat_new")?.showInMainCatalog, false);

const dictDir = join(process.cwd(), "lib/i18n/dictionaries");
for (const file of ["en.ts", "ar.ts", "he.ts"]) {
  const source = readFileSync(join(dictDir, file), "utf8");
  for (const key of [
    "next:",
    "back:",
    "finish:",
    "showInMainPage:",
    "saveTimeout:",
    "manageProducts:",
    "chooseExisting:",
    "addNewProduct:",
    "saved:",
  ]) {
    assert.ok(source.includes(key), `missing ${key} in ${file}`);
  }
}
assert.ok(
  readFileSync(join(dictDir, "ar.ts"), "utf8").includes(
    "إظهار الفئة في صفحة المنتجات الرئيسية",
  ),
);
assert.ok(
  readFileSync(join(dictDir, "ar.ts"), "utf8").includes("إدارة منتجات الفئة"),
);
assert.ok(readFileSync(join(dictDir, "ar.ts"), "utf8").includes("التالي"));
assert.ok(
  readFileSync(join(dictDir, "ar.ts"), "utf8").includes("تم حفظ الفئة بنجاح"),
);
assert.ok(
  readFileSync(join(dictDir, "ar.ts"), "utf8").includes(
    "تم حفظ إعدادات الفئة وربط المنتجات المحددة بنجاح.",
  ),
);
for (const file of ["en.ts", "ar.ts", "he.ts"]) {
  const source = readFileSync(join(dictDir, file), "utf8");
  for (const key of ["savedTitle:", "savedDetail:", "saveBusy:", "productTypesGroup:"]) {
    assert.ok(source.includes(key), `missing ${key} in ${file}`);
  }
}

const testCategory = custom("cat_test_filter", true, {
  ar: "test",
  he: "test",
  en: "test",
});
const hiddenManageable = custom("cat_hidden_manage", false, {
  ar: "مخفية للإدارة",
  he: "מוסתרת",
  en: "Hidden Admin",
});
const selectorCats = mergeCatalogCategories([testCategory, hiddenManageable]);
const selectorGroups = categorySelectorGroups(selectorCats, "ar");
assert.ok(selectorGroups.some((group) => group.key === "types"));
assert.ok(selectorGroups.some((group) => group.key === "extra"));
const extraIds = selectorGroups
  .find((group) => group.key === "extra")!
  .items.map((item) => item.id);
assert.ok(extraIds.includes("cat_test_filter"));
assert.ok(extraIds.includes("cat_hidden_manage"));
assert.equal(
  selectorGroups.find((group) => group.key === "extra")!.items.find((item) => item.id === "cat_test_filter")?.label,
  "test",
);
assert.ok(
  selectorGroups
    .find((group) => group.key === "types")!
    .items.some((item) => item.id === "Frames"),
);

const assignedToTest = applyCategoryAssignments(
  [frame, legacy, draft, publishedMulti],
  "cat_test_filter",
  ["p-frame", "p-legacy", "p-draft", "p-multi"],
);
assert.equal(productMatchesCategoryFilter(assignedToTest.find((item) => item.id === "p-frame")!, "cat_test_filter"), true);
assert.equal(productMatchesCategoryFilter(assignedToTest.find((item) => item.id === "p-legacy")!, "Sunglasses"), true);
assert.equal(productMatchesCategoryFilter(assignedToTest.find((item) => item.id === "p-legacy")!, "cat_test_filter"), true);
assert.equal(
  assignedToTest.filter((item) => item.id === "p-frame").length,
  1,
);
const persistedIds = assignedProductIdsForCategory(assignedToTest, "cat_test_filter");
assert.deepEqual(persistedIds.sort(), ["p-draft", "p-frame", "p-legacy", "p-multi"]);
assert.equal(countCategoryProducts(assignedToTest, "cat_test_filter"), 4);
assert.equal(publicEligibleAssignedCount(assignedToTest, "cat_test_filter"), 3);

const reloadedAfterAssign = mergeCatalogCategories([
  ...categories,
  testCategory,
  hiddenManageable,
]);
const reloadedProducts = applyCategoryAssignments(
  assignedToTest,
  "cat_test_filter",
  persistedIds,
);
assert.equal(countCategoryProducts(reloadedProducts, "cat_test_filter"), 4);
assert.equal(productBelongsToCategory(reloadedProducts.find((item) => item.id === "p-frame")!, "cat_luxury"), true);
assert.equal(reloadedProducts.find((item) => item.id === "p-frame")?.category, "Frames");

const publicTest = filterProductsForRequest({
  products: reloadedProducts,
  categories: reloadedAfterAssign,
  requestedCategoryIds: ["cat_test_filter"],
  admin: false,
});
assert.deepEqual(publicTest.map((item) => item.id).sort(), ["p-frame", "p-legacy", "p-multi"]);
assert.ok(!publicTest.some((item) => item.id === "p-draft"));
assert.equal(new Set(publicTest.map((item) => item.id)).size, publicTest.length);

const publicDtoIds = publicProductCategoryIds(
  reloadedProducts.find((item) => item.id === "p-frame")!,
  reloadedAfterAssign,
);
assert.ok(publicDtoIds.includes("cat_test_filter"));
assert.ok(publicDtoIds.includes("Frames"));

const hiddenStillAssignable = filterProductsForRequest({
  products: applyCategoryAssignments(reloadedProducts, "cat_hidden_manage", ["p-frame"]),
  categories: reloadedAfterAssign,
  requestedCategoryIds: ["cat_hidden_manage"],
  admin: true,
});
assert.ok(hiddenStillAssignable.some((item) => item.id === "p-frame"));
const hiddenPublic = filterProductsForRequest({
  products: applyCategoryAssignments(reloadedProducts, "cat_hidden_manage", ["p-frame"]),
  categories: reloadedAfterAssign,
  requestedCategoryIds: ["cat_hidden_manage"],
  admin: false,
});
assert.deepEqual(hiddenPublic, []);

const typePageUnchanged = filterProductsForRequest({
  products: [
    product({ id: "sun", category: "Sunglasses", categoryIds: ["cat_test_filter"] }),
    product({ id: "frame-extra", category: "Frames", categoryIds: ["Sunglasses"] }),
  ],
  categories: reloadedAfterAssign,
  requestedCategoryIds: ["Sunglasses"],
  admin: false,
});
assert.deepEqual(typePageUnchanged.map((item) => item.id), ["sun"]);

console.log("catalog-categories tests passed");

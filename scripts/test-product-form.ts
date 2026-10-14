import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatFrameSizePublic,
  isFrameSizeInput,
  normalizeFrameSize,
  sanitizeBarcode,
  sanitizeFrameSize,
  sanitizeProductColor,
} from "../lib/product-fields";
import {
  allocateProductNumber,
  ensureProductNumbers,
  isProductNumberTaken,
  normalizeProductNumber,
  resolveProductNumber,
  uniqueProductSlug,
} from "../lib/product-number";
import {
  alignProductImageFocals,
  persistProductImageFocals,
  productImageStyle,
} from "../lib/product-images";
import { computeDiscountedPrice } from "../lib/promo-price";
import {
  bestPromotionForProduct,
  productDiscountedPrice,
} from "../lib/promotions";
import type { Product, Promotion } from "../lib/types";

function product(
  partial: Partial<Product> & Pick<Product, "id" | "name">,
): Product {
  return {
    slug: partial.slug || partial.id,
    category: "Frames",
    brand: "OYON",
    sku: partial.sku ?? "",
    description: "",
    images: [],
    purchasePrice: 1,
    sellingPrice: 200,
    stockQuantity: 4,
    minimumStock: 1,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function promo(partial: Partial<Promotion> & Pick<Promotion, "id" | "title">): Promotion {
  return {
    description: "",
    discount: "20%",
    discountType: "percentage",
    discountValue: 20,
    scope: "specific",
    productIds: [],
    startDate: "2020-01-01",
    endDate: "2099-12-31",
    homepageVisible: true,
    priority: 10,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

assert.equal(normalizeProductNumber("rb-24"), "RB-24");
assert.equal(normalizeProductNumber("RB-024"), "RB-24");
assert.equal(allocateProductNumber([]), "RB-1");
assert.equal(
  allocateProductNumber([product({ id: "a", name: "A", sku: "RB-1" })]),
  "RB-2",
);
assert.equal(
  allocateProductNumber([
    product({ id: "a", name: "A", sku: "RB-1" }),
    product({ id: "c", name: "C", sku: "RB-3" }),
  ]),
  "RB-2",
);
assert.equal(
  allocateProductNumber(
    [
      product({ id: "a", name: "A", sku: "RB-1" }),
      product({ id: "b", name: "B", sku: "RB-2" }),
    ],
    "b",
  ),
  "RB-2",
);

const existing = [
  product({ id: "keep", name: "Keep", sku: "LUM-FR-001" }),
  product({ id: "empty-a", name: "Empty A", sku: "" }),
  product({ id: "empty-b", name: "Empty B" }),
];
const numbered = ensureProductNumbers(existing);
assert.equal(numbered[0].sku, "LUM-FR-001");
assert.equal(numbered[1].sku, "RB-1");
assert.equal(numbered[2].sku, "RB-2");
assert.equal(numbered[0].id, "keep");
assert.equal(numbered[1].id, "empty-a");

assert.equal(isProductNumberTaken("RB-1", numbered), true);
assert.equal(isProductNumberTaken("rb-1", numbered, "empty-a"), false);
assert.equal(
  resolveProductNumber("RB-100", numbered),
  "RB-100",
);
assert.throws(
  () => resolveProductNumber("RB-1", numbered, undefined, false),
  /PRODUCT_NUMBER_TAKEN/,
);
assert.equal(resolveProductNumber("RB-1", numbered, undefined, true), "RB-3");
assert.equal(resolveProductNumber("", numbered, undefined, true), "RB-3");

const sameName = [
  product({ id: "p1", name: "Ray-Ban", slug: "ray-ban" }),
  product({ id: "p2", name: "Ray-Ban", slug: "ray-ban-2" }),
];
assert.equal(uniqueProductSlug("Ray-Ban", sameName), "ray-ban-3");
assert.equal(uniqueProductSlug("Ray-Ban", sameName, "p1", "ray-ban"), "ray-ban");
assert.equal(uniqueProductSlug("أسود", []), "product");

assert.equal(normalizeFrameSize("052-018"), "52-018");
assert.equal(normalizeFrameSize("52-018"), "52-018");
assert.equal(normalizeFrameSize("052 - 018"), "52-018");
assert.equal(normalizeFrameSize("52-18"), "52-18");
assert.equal(normalizeFrameSize(""), undefined);
assert.equal(normalizeFrameSize("abc"), null);
assert.equal(sanitizeFrameSize("052-018"), "52-018");
assert.equal(sanitizeFrameSize("bad"), undefined);
assert.equal(formatFrameSizePublic("018-052"), "18*52");
assert.equal(formatFrameSizePublic("052-018"), "52*18");
assert.equal(formatFrameSizePublic("050-020"), "50*20");
assert.equal(formatFrameSizePublic("52-018"), "52*18");
assert.equal(formatFrameSizePublic(""), undefined);
assert.equal(normalizeFrameSize("018-052"), "18-052");
assert.equal(isFrameSizeInput("052"), true);
assert.equal(isFrameSizeInput("052-018"), true);
assert.equal(isFrameSizeInput("red"), false);

assert.equal(sanitizeProductColor("أسود"), "أسود");
assert.equal(sanitizeProductColor("  Black  "), "Black");
assert.equal(sanitizeProductColor("שחור"), "שחור");
assert.equal(sanitizeBarcode("  1234567890123  "), "1234567890123");
assert.equal(sanitizeBarcode(""), undefined);

const frame = product({
  id: "frame-1",
  name: "Frame",
  category: "Frames",
  sellingPrice: 200,
});
const cheap = promo({
  id: "promo-cheap",
  title: "Cheap",
  priority: 1,
  productIds: ["frame-1"],
  discountValue: 10,
});
const better = promo({
  id: "promo-better",
  title: "Better",
  priority: 5,
  productIds: ["frame-1"],
  discountValue: 50,
});
const expired = promo({
  id: "promo-old",
  title: "Old",
  priority: 0,
  productIds: ["frame-1"],
  discountValue: 90,
  endDate: "2020-01-01",
});
const inactive = promo({
  id: "promo-off",
  title: "Off",
  priority: 0,
  productIds: ["frame-1"],
  discountValue: 90,
  active: false,
});

assert.equal(computeDiscountedPrice(200, cheap), 180);
assert.equal(computeDiscountedPrice(200, {
  ...cheap,
  discountType: "fixed",
  discountValue: 25,
  discount: "₪25",
}), 175);

const winner = bestPromotionForProduct(frame, [better, cheap, expired, inactive]);
assert.equal(winner?.id, "promo-cheap");
assert.equal(productDiscountedPrice(frame, [better, cheap, expired, inactive]), 180);
assert.equal(productDiscountedPrice(frame, [expired, inactive]), undefined);
assert.equal(frame.sellingPrice, 200);

const sunglasses = product({
  id: "sg-1",
  name: "Sun",
  category: "Sunglasses",
  sellingPrice: 400,
});
const sunPromo = promo({
  id: "promo-sun",
  title: "Sun sale",
  scope: "sunglasses",
  priority: 1,
  discountValue: 25,
});
assert.equal(productDiscountedPrice(sunglasses, [sunPromo]), 300);
assert.equal(productDiscountedPrice(frame, [sunPromo]), undefined);

assert.equal(persistProductImageFocals(["a.jpg"], []), undefined);
assert.equal(persistProductImageFocals(["a.jpg"], [{ x: 0.5, y: 0.5, zoom: 1 }]), undefined);
assert.equal(productImageStyle(undefined), undefined);
assert.equal(productImageStyle({ x: 0.5, y: 0.5, zoom: 1 }), undefined);

const savedFocal = persistProductImageFocals(
  ["a.jpg", "b.jpg"],
  [{ x: 0.2, y: 0.8, zoom: 1.2 }],
);
assert.equal(savedFocal?.[0]?.x, 0.2);
assert.equal(savedFocal?.[0]?.zoom, 1.2);
assert.equal(savedFocal?.[1]?.x, 0.5);
assert.equal(savedFocal?.[1]?.zoom, 1);

const reordered = alignProductImageFocals(
  ["b.jpg", "a.jpg"],
  [savedFocal![1], savedFocal![0]],
);
assert.equal(reordered[0].x, 0.5);
assert.equal(reordered[1].x, 0.2);

const panned = productImageStyle({ x: 0.25, y: 0.75, zoom: 1 });
assert.match(panned?.objectPosition || "", /25%/);
assert.equal(panned?.transform, undefined);

const zoomed = productImageStyle({ x: 0.5, y: 0.5, zoom: 1.4 }, { preview: true });
assert.match(zoomed?.transform || "", /1\.4/);

const imagesField = readFileSync(
  join(process.cwd(), "components/admin/ProductImagesField.tsx"),
  "utf8",
);
assert.match(imagesField, /ProductImageFocalEditor/);
assert.match(imagesField, /imageFocals/);
const focalEditor = readFileSync(
  join(process.cwd(), "components/admin/ProductImageFocalEditor.tsx"),
  "utf8",
);
assert.match(focalEditor, /type="range"/);
assert.match(focalEditor, /sliderPercentToZoom/);
assert.match(focalEditor, /heroPositionX/);
assert.match(focalEditor, /admin-pe-focal-layout/);
assert.match(focalEditor, /admin-pe-focal-preview/);
const peCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
assert.match(peCss, /\.admin-pe-focal-preview\s*\{[\s\S]*width:\s*240px/);
assert.match(peCss, /\.admin-pe-focal-layout\s*\{[\s\S]*grid-template-columns:\s*240px/);
assert.match(peCss, /\.admin-pe-thumb\s*\{[\s\S]*width:\s*110px/);
assert.match(peCss, /\.admin-pe-focal-sliders\s*\{[\s\S]*width:\s*350px/);
assert.match(imagesField, /setSelectedIndex\(index\)/);

console.log("test-product-form: ok");

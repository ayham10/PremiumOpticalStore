import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyProductTranslations,
  ManualTranslationError,
  PRODUCT_CONTENT_LOCALES,
  productSearchText,
  resolveProductCopy,
  sanitizeProductLocales,
  withProductLocale,
  wouldOverwriteManual,
  type ProductI18nFields,
} from "../lib/product-i18n";

const fakeTranslate = async (text: string, _from: string, to: string) =>
  `[${to}]${text}`;

function product(partial: Partial<ProductI18nFields> = {}): ProductI18nFields {
  return {
    name: "HOYA japan",
    description: "Quality lenses",
    color: "Black",
    ...partial,
  };
}

const ar = resolveProductCopy(product(), "ar");
assert.equal(ar.name, "HOYA japan");
assert.equal(ar.description, "Quality lenses");
assert.equal(ar.color, "Black");

const withHe = product({
  locales: {
    he: { name: "הויה יפן", description: "עדשות", color: "שחור" },
  },
});
assert.equal(resolveProductCopy(withHe, "he").name, "הויה יפן");
assert.equal(resolveProductCopy(withHe, "en").name, "HOYA japan");
assert.equal(withProductLocale(withHe, "he").name, "הויה יפן");

async function main() {
const created = await applyProductTranslations({
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي", color: "أسود" },
  translate: fakeTranslate,
});
assert.equal(created.name, "إطار ذهبي");
assert.equal(created.i18nSource, "ar");
assert.equal(created.locales.ar?.name, "إطار ذهبي");
assert.equal(created.locales.ar?.origins?.name, "manual");
assert.equal(created.locales.he?.name, "[he]إطار ذهبي");
assert.equal(created.locales.en?.name, "[en]إطار ذهبي");
assert.equal(created.locales.he?.origins?.name, "machine");
assert.equal(created.locales.en?.description, "[en]وصف عربي");

const existing: ProductI18nFields = {
  name: "HOYA japan",
  description: "Quality lenses",
  color: "Black",
  i18nSource: "en",
  locales: {
    en: {
      name: "HOYA japan",
      description: "Quality lenses",
      color: "Black",
      origins: { name: "manual", description: "manual", color: "manual" },
    },
    he: {
      name: "[he]HOYA japan",
      description: "[he]Quality lenses",
      color: "[he]Black",
      origins: { name: "machine", description: "machine", color: "machine" },
    },
    ar: {
      name: "هويّا",
      description: "عدسات يدوي",
      color: "أسود",
      origins: { name: "manual", description: "manual", color: "manual" },
    },
  },
};

assert.deepEqual(wouldOverwriteManual({
  existing,
  sourceLocale: "en",
  fields: { name: "HOYA japan", description: "Quality lenses", color: "Black" },
}), []);

assert.ok(
  wouldOverwriteManual({
    existing,
    sourceLocale: "en",
    fields: { name: "HOYA updated", description: "Quality lenses", color: "Black" },
  }).includes("name"),
);

await assert.rejects(
  () =>
    applyProductTranslations({
      existing,
      sourceLocale: "en",
      fields: { name: "HOYA updated", description: "Quality lenses", color: "Black" },
      translate: fakeTranslate,
    }),
  (err: unknown) => err instanceof ManualTranslationError,
);

const keptManual = await applyProductTranslations({
  existing,
  sourceLocale: "en",
  fields: { name: "HOYA japan", description: "Better lenses", color: "Black" },
  overwriteManual: true,
  translate: fakeTranslate,
});
assert.equal(keptManual.name, "HOYA japan", "existing root name stays");
assert.equal(keptManual.description, "Quality lenses", "existing root description stays");
assert.equal(keptManual.color, "Black");
assert.equal(keptManual.locales.ar?.name, "هويّا");
assert.equal(keptManual.locales.he?.description, "[he]Better lenses");
assert.equal(keptManual.locales.he?.origins?.description, "machine");

const machineOnly: ProductI18nFields = {
  name: "Aurelia Acetate",
  description: "Frame",
  locales: {
    en: {
      name: "Aurelia Acetate",
      description: "Frame",
      origins: { name: "manual", description: "manual" },
    },
    he: {
      name: "[he]Aurelia Acetate",
      description: "[he]Frame",
      origins: { name: "machine", description: "machine" },
    },
  },
};
const updatedMachine = await applyProductTranslations({
  existing: machineOnly,
  sourceLocale: "en",
  fields: { name: "Aurelia Gold", description: "Frame" },
  translate: fakeTranslate,
});
assert.equal(updatedMachine.name, "Aurelia Acetate");
assert.equal(updatedMachine.locales.he?.name, "[he]Aurelia Gold");
assert.equal(updatedMachine.locales.he?.origins?.name, "machine");
assert.deepEqual(updatedMachine.failures, []);

let inflight = 0;
let maxInflight = 0;
const parallelTranslate = async (text: string, _from: string, to: string) => {
  inflight += 1;
  maxInflight = Math.max(maxInflight, inflight);
  await new Promise((resolve) => setTimeout(resolve, 8));
  inflight -= 1;
  return `[${to}]${text}`;
};
await applyProductTranslations({
  sourceLocale: "ar",
  fields: { name: "إطار", description: "وصف", color: "أسود" },
  translate: parallelTranslate,
});
assert.ok(maxInflight > 1, "product translations run in parallel");

const failingTranslate = async (text: string, _from: string, to: string) => {
  if (to === "he") throw new Error("quota exceeded");
  return `[${to}]${text}`;
};
const partial = await applyProductTranslations({
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي", color: "أسود" },
  translate: failingTranslate,
});
assert.equal(partial.locales.en?.name, "[en]إطار ذهبي");
assert.equal(partial.locales.he?.name || "", "", "failed locale is not stored as source echo");
assert.ok(partial.failures.some((item) => item.locale === "he" && item.path === "name"));

const retried = await applyProductTranslations({
  existing: {
    name: "إطار ذهبي",
    description: "وصف عربي",
    color: "أسود",
    i18nSource: "ar",
    locales: partial.locales,
  },
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي", color: "أسود" },
  translate: fakeTranslate,
});
assert.equal(retried.locales.he?.name, "[he]إطار ذهبي");
assert.equal(retried.locales.en?.name, "[en]إطار ذهبي");
assert.deepEqual(retried.failures, []);

const echoed: ProductI18nFields = {
  name: "إطار ذهبي",
  description: "وصف عربي",
  i18nSource: "ar",
  locales: {
    ar: {
      name: "إطار ذهبي",
      description: "وصف عربي",
      origins: { name: "manual", description: "manual" },
    },
    he: {
      name: "إطار ذهبي",
      description: "وصف عربي",
      origins: { name: "machine", description: "machine" },
    },
  },
};
const repaired = await applyProductTranslations({
  existing: echoed,
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي" },
  translate: fakeTranslate,
});
assert.equal(repaired.locales.he?.name, "[he]إطار ذهبي");

const sanitized = sanitizeProductLocales({
  he: { name: "  x  ", origins: { name: "manual", bogus: "nope" } },
  xx: { name: "nope" },
});
assert.equal(sanitized.he?.name, "x");
assert.equal(sanitized.he?.origins?.name, "manual");
assert.equal((sanitized as { xx?: unknown }).xx, undefined);

const searchable = productSearchText(withHe);
assert.ok(searchable.includes("הויה"));
assert.ok(searchable.includes("hoya japan"));

assert.deepEqual([...PRODUCT_CONTENT_LOCALES], ["ar", "he", "en"]);

const peCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
assert.match(peCss, /\.admin-products-langs\s*\{/);
assert.match(peCss, /\.admin-pe-langs\s*\{/);

console.log("test-product-i18n: ok");
}

void main();

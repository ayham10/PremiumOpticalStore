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

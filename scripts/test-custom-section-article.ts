import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseArticleAlign,
  parseArticlePosition,
  resolveSectionArticle,
  sanitizeArticleHeading,
  sparseSectionArticle,
} from "../lib/custom-service-pages";
import type { CustomPageSection } from "../lib/types";

const root = process.cwd();

const section: CustomPageSection = {
  id: "sec_a",
  type: "featureGrid",
  article: {
    align: "center",
    position: "before",
    locales: {
      ar: { heading: "ماذا يشمل فحص النظر لدينا", body: "وصف\nسطر ثاني" },
      he: { heading: "", body: "טקסט בלבד" },
    },
  },
};

assert.equal(parseArticleAlign("left"), "left");
assert.equal(parseArticleAlign("nope"), "center");
assert.equal(parseArticlePosition("after"), "after");
assert.equal(parseArticlePosition("side"), "before");

const ar = resolveSectionArticle(section, "ar");
assert.ok(ar);
assert.equal(ar!.align, "center");
assert.equal(ar!.position, "before");
assert.equal(ar!.heading, "ماذا يشمل فحص النظر لدينا");
assert.match(ar!.body, /سطر ثاني/);

const he = resolveSectionArticle(section, "he");
assert.ok(he);
assert.equal(he!.heading, "");
assert.equal(he!.body, "טקסט בלבד");
assert.equal(resolveSectionArticle(section, "en"), null);

assert.equal(sparseSectionArticle({ align: "right", locales: {} }), undefined);
assert.equal(
  sparseSectionArticle({
    align: "right",
    position: "after",
    locales: { ar: { heading: "<i>ذهب</i>", body: "  " } },
  })?.locales?.ar?.heading,
  "ذهب",
);

const other: CustomPageSection = {
  id: "sec_b",
  type: "products",
  article: {
    align: "right",
    position: "after",
    locales: { ar: { heading: "منتجات", body: "" } },
  },
};
assert.notEqual(resolveSectionArticle(section, "ar")?.heading, resolveSectionArticle(other, "ar")?.heading);
assert.notEqual(section.id, other.id);

assert.equal(sanitizeArticleHeading("x".repeat(200)).length, 140);

const view = readFileSync(join(root, "components/services/CustomServicePageView.tsx"), "utf8");
assert.match(view, /resolveSectionArticle/);
assert.match(view, /withSectionArticle/);
assert.match(view, /CustomSectionArticle/);
assert.doesNotMatch(view, /pickServiceText\(.*article/);

const articleCmp = readFileSync(
  join(root, "components/services/CustomSectionArticle.tsx"),
  "utf8",
);
assert.match(articleCmp, /is-before/);
assert.match(articleCmp, /is-after/);
assert.match(articleCmp, /align === "center"/);
assert.match(articleCmp, /align === "right"/);
assert.match(articleCmp, /align === "left"/);
assert.match(articleCmp, /if \(!title && !text\) return null/);

const css = readFileSync(join(root, "app/globals.css"), "utf8");
assert.match(css, /\.csp-article\.is-center/);
assert.match(css, /\.csp-article-rule\.is-before/);
assert.match(css, /\.csp-article-rule\.is-after/);
assert.match(css, /var\(--ee-gold\)/);
assert.doesNotMatch(css, /\.csp-article\s*\{[^}]*border:/);

const builder = readFileSync(join(root, "components/admin/CustomPageBuilder.tsx"), "utf8");
assert.match(builder, /renderSectionArticle/);
assert.match(builder, /articleGroup/);
assert.match(builder, /articleAlignCenter/);
assert.match(builder, /articlePositionBefore/);
assert.match(builder, /heroMedia[\s\S]*renderSectionArticle/);
assert.match(builder, /featureGrid[\s\S]*renderSectionArticle/);
assert.match(builder, /benefitsList[\s\S]*renderSectionArticle/);
assert.match(builder, /notice[\s\S]*renderSectionArticle/);
assert.match(builder, /valuesStrip[\s\S]*renderSectionArticle/);
assert.match(builder, /bookingCta[\s\S]*renderSectionArticle/);
assert.match(builder, /products[\s\S]*renderSectionArticle/);
assert.match(builder, /gallery[\s\S]*renderSectionArticle/);

const arDict = readFileSync(join(root, "lib/i18n/dictionaries/ar.ts"), "utf8");
const heDict = readFileSync(join(root, "lib/i18n/dictionaries/he.ts"), "utf8");
const enDict = readFileSync(join(root, "lib/i18n/dictionaries/en.ts"), "utf8");
assert.match(arDict, /عنوان ونص إضافي/);
assert.match(heDict, /כותרת וטקסט נוספים/);
assert.match(enDict, /Optional heading and text/);
assert.match(arDict, /قبل محتوى القسم/);
assert.match(heDict, /לפני תוכן הקטע/);
assert.match(enDict, /Before section content/);

const eyeExam = readFileSync(join(root, "components/eye-exam/EyeExamPage.tsx"), "utf8");
assert.match(eyeExam, /eye-exam-benefits-title/);
assert.doesNotMatch(eyeExam, /csp-article/);

const persist = readFileSync(join(root, "lib/custom-service-pages.ts"), "utf8");
assert.match(persist, /sparseSectionArticle/);
assert.match(persist, /stripMarkup/);

console.log("custom-section-article tests passed");

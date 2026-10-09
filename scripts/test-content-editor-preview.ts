import assert from "node:assert/strict";
import {
  buildEditorPreviewDocument,
  CONTENT_PREVIEW_PATH,
  CONTENT_PREVIEW_VIEWPORTS,
  customPageEditorSnapshot,
  editorPanelDir,
  isContentPreviewMessage,
  isContentPreviewVisibilityMessage,
  PREVIEW_UPDATE_MS,
  previewFlushKey,
  previewWriteMethodBlocked,
  shouldFlushPreviewNow,
  viewHrefForEditor,
} from "../lib/content-editor-preview";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";
import { persistCustomPages } from "../lib/custom-service-pages";
import type { CustomServicePage } from "../lib/types";

const ar = defaultServicePagesForLocale("ar");
const he = defaultServicePagesForLocale("he");

const created = persistCustomPages([], {
  customPageOp: {
    op: "create",
    name: "Multifocal",
    slug: "multifocal-lenses",
    template: "eye-exam",
  },
});
const page = created[0] as CustomServicePage;

const document = buildEditorPreviewDocument(undefined, "he", he, {
  ...page,
  locales: {
    he: {
      ...page.locales.he,
      title: "עדשות מולטיפוקל",
      complete: true,
    },
  },
});

assert.equal(document.locales?.he?.eyeExam.title, he.eyeExam.title);
assert.equal(document.customPages?.[0]?.locales.he?.title, "עדשות מולטיפוקל");
assert.equal(editorPanelDir("ar"), "rtl");
assert.equal(editorPanelDir("he"), "rtl");
assert.equal(editorPanelDir("en"), "ltr");
assert.equal(viewHrefForEditor("homepage"), "/");
assert.equal(viewHrefForEditor("eyeExam"), "/eye-exams");
assert.equal(viewHrefForEditor("contactLenses"), "/contact-lenses");
assert.equal(viewHrefForEditor("custom", "multifocal-lenses"), "/services/multifocal-lenses");
assert.equal(CONTENT_PREVIEW_PATH, "/admin/service-pages/preview");
assert.equal(CONTENT_PREVIEW_VIEWPORTS.mobile.width, 390);
assert.equal(CONTENT_PREVIEW_VIEWPORTS.desktop.width, 1280);
assert.ok(CONTENT_PREVIEW_VIEWPORTS.mobile.width < 768);
assert.ok(CONTENT_PREVIEW_VIEWPORTS.desktop.width >= 1024);

const dirtyA = customPageEditorSnapshot({
  name: page.name,
  slug: page.slug,
  status: page.status,
  showOnHome: page.showOnHome,
  homeSort: page.homeSort,
  homeImage: page.homeImage,
  showHeroButton: page.showHeroButton,
  ctaKind: page.ctaKind,
  ctaHref: page.ctaHref,
  bookingType: page.bookingType,
  sections: page.sections,
  heroMedia: page.heroMedia,
  gallery: page.gallery,
  productIds: page.productIds,
  copy: { title: "A" },
});
const dirtyB = customPageEditorSnapshot({
  name: page.name,
  slug: page.slug,
  status: page.status,
  showOnHome: page.showOnHome,
  homeSort: page.homeSort,
  homeImage: page.homeImage,
  showHeroButton: page.showHeroButton,
  ctaKind: page.ctaKind,
  ctaHref: page.ctaHref,
  bookingType: page.bookingType,
  sections: page.sections,
  heroMedia: page.heroMedia,
  gallery: page.gallery,
  productIds: page.productIds,
  copy: { title: "B" },
});
assert.notEqual(dirtyA, dirtyB);

assert.equal(
  isContentPreviewMessage({
    type: "oyon-content-preview",
    payload: { locale: "ar", kind: "homepage" },
  }),
  true,
);
assert.equal(isContentPreviewMessage({ type: "nope" }), false);

const arDoc = buildEditorPreviewDocument(undefined, "ar", {
  ...ar,
  homepage: {
    hero: {
      ...ar.homepage!.hero,
      title: "عنوان تجريبي",
    },
  },
});
assert.equal(arDoc.locales?.ar?.homepage?.hero.title, "عنوان تجريبي");

assert.ok(PREVIEW_UPDATE_MS >= 150 && PREVIEW_UPDATE_MS <= 300);
assert.equal(shouldFlushPreviewNow(null, "ar:homepage:"), true);
assert.equal(
  shouldFlushPreviewNow("ar:homepage:", previewFlushKey("ar", "homepage")),
  false,
);
assert.equal(
  shouldFlushPreviewNow("ar:homepage:", previewFlushKey("he", "homepage")),
  true,
);
assert.equal(previewWriteMethodBlocked("GET"), false);
assert.equal(previewWriteMethodBlocked("HEAD"), false);
assert.equal(previewWriteMethodBlocked("PUT"), true);
assert.equal(previewWriteMethodBlocked("POST"), true);
assert.equal(previewWriteMethodBlocked("PATCH"), true);
assert.equal(previewWriteMethodBlocked("DELETE"), true);
assert.equal(
  isContentPreviewVisibilityMessage({
    type: "oyon-content-preview-visibility",
    visible: false,
  }),
  true,
);
assert.equal(isContentPreviewVisibilityMessage({ type: "oyon-content-preview" }), false);

console.log("content-editor-preview tests passed");

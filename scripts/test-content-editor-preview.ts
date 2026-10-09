import assert from "node:assert/strict";
import {
  buildEditorPreviewDocument,
  CONTENT_PREVIEW_CHROME,
  CONTENT_PREVIEW_PATH,
  CONTENT_PREVIEW_VIEWPORTS,
  fitPreviewScale,
  normalizeWheelDelta,
  PREVIEW_DRAG_THRESHOLD_PX,
  screenDeltaToPreviewScroll,
  shouldStartPreviewDrag,
  customPageEditorSnapshot,
  editorPanelDir,
  isContentPreviewFocusMessage,
  isContentPreviewMessage,
  isContentPreviewVisibilityMessage,
  PREVIEW_UPDATE_MS,
  previewFlushKey,
  previewWriteMethodBlocked,
  shouldFlushPreviewNow,
  viewHrefForEditor,
} from "../lib/content-editor-preview";
import {
  clampWizardStep,
  wizardCanGoBack,
  wizardCanGoNext,
} from "../lib/content-editor-wizard";
import {
  previewPlaceholderProducts,
  withPreviewPlaceholders,
} from "../lib/preview-placeholders";
import { emptyCustomPageCopy, persistCustomPages } from "../lib/custom-service-pages";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";
import { EDITOR_SECTION_ICONS } from "../components/admin/content-editor/EditorSection";
import { coverCropRect, mediaUrlForViewport } from "../lib/responsive-image";
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
assert.equal(shouldFlushPreviewNow(null, "ar:homepage::"), true);
assert.equal(
  shouldFlushPreviewNow("ar:homepage::", previewFlushKey("ar", "homepage")),
  false,
);
assert.equal(
  shouldFlushPreviewNow("ar:homepage::", previewFlushKey("he", "homepage")),
  true,
);
assert.equal(
  shouldFlushPreviewNow(
    previewFlushKey("ar", "custom", "p1", "hero-1"),
    previewFlushKey("ar", "custom", "p1", "hero-1"),
  ),
  false,
);
assert.equal(
  shouldFlushPreviewNow(
    previewFlushKey("ar", "custom", "p1", "hero-1"),
    previewFlushKey("ar", "custom", "p1", "features-2"),
  ),
  true,
);
assert.equal(
  isContentPreviewFocusMessage({
    type: "oyon-content-preview-focus",
    sectionId: "hero-1",
  }),
  true,
);
assert.equal(isContentPreviewFocusMessage({ type: "oyon-content-preview" }), false);
assert.equal(clampWizardStep(0), 1);
assert.equal(clampWizardStep(3), 3);
assert.equal(clampWizardStep(9), 4);
assert.equal(wizardCanGoBack(1), false);
assert.equal(wizardCanGoNext(4), false);
assert.equal(wizardCanGoNext(2), true);

const blankCopy = emptyCustomPageCopy();
const previewCopy = withPreviewPlaceholders(blankCopy, "ar");
assert.equal(blankCopy.title, "");
assert.ok(previewCopy.title.length > 0);
assert.ok(previewCopy.features[0]?.title);
assert.ok(previewCopy.benefits[0]);
const realCopy = withPreviewPlaceholders(
  { ...blankCopy, title: "فحص أطفال" },
  "ar",
);
assert.equal(realCopy.title, "فحص أطفال");
const fakeProducts = previewPlaceholderProducts("en");
assert.equal(fakeProducts.length, 3);
assert.ok(fakeProducts[0]?.id.startsWith("preview-placeholder-"));
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

assert.deepEqual(Object.keys(EDITOR_SECTION_ICONS).sort(), [
  "buttons",
  "gallery",
  "hero",
  "links",
  "page",
  "products",
  "sections",
  "settings",
  "text",
]);
assert.equal(EDITOR_SECTION_ICONS.text.displayName, "Type");
assert.equal(EDITOR_SECTION_ICONS.hero.displayName, "Image");
assert.equal(EDITOR_SECTION_ICONS.buttons.displayName, "MousePointerClick");
assert.equal(EDITOR_SECTION_ICONS.products.displayName, "Package");
assert.equal(EDITOR_SECTION_ICONS.gallery.displayName, "Images");
assert.equal(EDITOR_SECTION_ICONS.settings.displayName, "Settings");
assert.equal(EDITOR_SECTION_ICONS.page.displayName, "FileText");
assert.equal(EDITOR_SECTION_ICONS.links.displayName, "Link");
assert.equal(EDITOR_SECTION_ICONS.sections.displayName, "Layers");
assert.equal(EDITOR_SECTION_ICONS.hero.displayName, "Image");

const crop = coverCropRect(1600, 900, 9, 16, { x: 0.5, y: 0.38, zoom: 1 });
assert.ok(Math.abs(crop.sw / crop.sh - 9 / 16) < 0.02);
assert.ok(crop.sh <= 900);
assert.equal(
  mediaUrlForViewport(
    {
      kind: "image",
      url: "https://cdn.example/orig.jpg",
      mobileUrl: "https://cdn.example/m.webp",
    },
    "mobile",
  ),
  "https://cdn.example/m.webp",
);
assert.equal(
  mediaUrlForViewport(
    { kind: "image", url: "https://cdn.example/orig.jpg" },
    "desktop",
  ),
  "https://cdn.example/orig.jpg",
);

assert.equal(CONTENT_PREVIEW_CHROME.mobile.width > 0, true);
assert.equal(CONTENT_PREVIEW_CHROME.desktop.height > 36, true);
const phoneScale = fitPreviewScale(400, 400, 390, 844, 24, 36);
assert.ok(phoneScale <= (400 - 24) / 390);
assert.ok(phoneScale <= (400 - 36) / 844);
assert.ok(phoneScale < 400 / 390);
assert.ok(fitPreviewScale(400, 400, 1280, 900, 20, 46) <= (400 - 20) / 1280);
assert.equal(fitPreviewScale(2000, 2000, 390, 844, 24, 36), 1);
assert.equal(screenDeltaToPreviewScroll(30, 0.3), 100);
assert.equal(normalizeWheelDelta({ deltaY: 2, deltaMode: 1 }), 32);
assert.equal(normalizeWheelDelta({ deltaY: 40, deltaMode: 0 }), 40);
assert.equal(shouldStartPreviewDrag(PREVIEW_DRAG_THRESHOLD_PX - 1), false);
assert.equal(shouldStartPreviewDrag(PREVIEW_DRAG_THRESHOLD_PX), true);

console.log("content-editor-preview tests passed");

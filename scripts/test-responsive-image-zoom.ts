import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clampImageFocal,
  coverCropRect,
  coverCropZoom,
  DEFAULT_IMAGE_FOCAL,
  freshHeroImage,
  hasGeneratedHeroVariants,
  heroDisplayUrl,
  IMAGE_ZOOM_MIN,
  IMAGE_ZOOM_NEUTRAL,
  IMAGE_ZOOM_SLIDER_MAX,
  IMAGE_ZOOM_SLIDER_NEUTRAL,
  liveHeroFocalVars,
  resetHeroFocals,
  shouldUseLiveHeroFocal,
  sliderPercentToZoom,
  zoomToSliderPercent,
} from "../lib/responsive-image";

assert.equal(DEFAULT_IMAGE_FOCAL.zoom, IMAGE_ZOOM_NEUTRAL);
assert.equal(zoomToSliderPercent(1), IMAGE_ZOOM_SLIDER_NEUTRAL);
assert.equal(zoomToSliderPercent(DEFAULT_IMAGE_FOCAL.zoom), 50);
assert.equal(sliderPercentToZoom(50), IMAGE_ZOOM_NEUTRAL);
assert.equal(sliderPercentToZoom(0), IMAGE_ZOOM_MIN);
assert.equal(sliderPercentToZoom(100), IMAGE_ZOOM_SLIDER_MAX);

const zoomedOut = sliderPercentToZoom(25);
assert.ok(zoomedOut < 1, "below 50% must reduce scale below the fitted cover");
assert.ok(zoomedOut > IMAGE_ZOOM_MIN);

const zoomedIn = sliderPercentToZoom(75);
assert.ok(zoomedIn > 1, "above 50% must increase scale above the fitted cover");
assert.ok(zoomedIn < IMAGE_ZOOM_SLIDER_MAX);

assert.equal(zoomToSliderPercent(1.1) > 50, true);
assert.equal(zoomToSliderPercent(0.7) < 50, true);
assert.equal(zoomToSliderPercent(2.5), 100);

const savedNeutral = clampImageFocal({ x: 0.4, y: 0.3, zoom: 1 });
assert.equal(savedNeutral.zoom, 1);
assert.equal(zoomToSliderPercent(savedNeutral.zoom), 50);

const savedZoomed = clampImageFocal({ x: 0.4, y: 0.3, zoom: 1.1 });
assert.equal(savedZoomed.zoom, 1.1);
assert.ok(Math.abs(savedZoomed.x - 0.4) < 1e-9);

const zoomOutFocal = clampImageFocal({ zoom: 0.7 });
assert.equal(zoomOutFocal.zoom, 0.7);

assert.equal(coverCropZoom(0.55), 1);
assert.equal(coverCropZoom(1), 1);
assert.equal(coverCropZoom(1.6), 1.6);

const coverNeutral = coverCropRect(1600, 900, 16, 9, { x: 0.5, y: 0.38, zoom: 1 });
const coverZoomOut = coverCropRect(1600, 900, 16, 9, { x: 0.5, y: 0.38, zoom: 0.6 });
assert.equal(coverNeutral.sw, coverZoomOut.sw);
assert.equal(coverNeutral.sh, coverZoomOut.sh);

const coverZoomIn = coverCropRect(1600, 900, 16, 9, { x: 0.5, y: 0.38, zoom: 1.5 });
assert.ok(coverZoomIn.sw < coverNeutral.sw);
assert.ok(coverZoomIn.sh < coverNeutral.sh);

const fresh = freshHeroImage({
  kind: "image",
  url: "https://cdn.example/new.jpg",
  mediaId: "media_1",
});
assert.equal(fresh.desktopFocal?.zoom, 1);
assert.equal(fresh.mobileFocal?.zoom, 1);
assert.equal(zoomToSliderPercent(fresh.desktopFocal!.zoom), 50);
assert.equal(zoomToSliderPercent(fresh.mobileFocal!.zoom), 50);
assert.equal(fresh.desktopUrl, undefined);
assert.equal(fresh.mobileUrl, undefined);
assert.equal(shouldUseLiveHeroFocal(fresh), true);
assert.equal(heroDisplayUrl(fresh, "mobile"), "https://cdn.example/new.jpg");
assert.equal(heroDisplayUrl(fresh, "desktop"), "https://cdn.example/new.jpg");

const legacy = {
  kind: "image" as const,
  url: "https://cdn.example/orig.jpg",
  desktopUrl: "https://cdn.example/desktop.webp",
  mobileUrl: "https://cdn.example/mobile.webp",
  desktopFocal: { x: 0.4, y: 0.3, zoom: 1.1 },
  mobileFocal: { x: 0.55, y: 0.42, zoom: 1.2 },
};
assert.equal(hasGeneratedHeroVariants(legacy), true);
assert.equal(shouldUseLiveHeroFocal(legacy), false);
assert.equal(heroDisplayUrl(legacy, "desktop"), "https://cdn.example/desktop.webp");
assert.equal(heroDisplayUrl(legacy, "mobile"), "https://cdn.example/mobile.webp");

const zoomedOutLegacy = {
  ...legacy,
  mobileFocal: { x: 0.55, y: 0.42, zoom: 0.7 },
};
assert.equal(shouldUseLiveHeroFocal(zoomedOutLegacy), true);
assert.equal(heroDisplayUrl(zoomedOutLegacy, "mobile"), "https://cdn.example/orig.jpg");
assert.equal(heroDisplayUrl(zoomedOutLegacy, "desktop"), "https://cdn.example/orig.jpg");

const contained = { ...legacy, fit: "contain" as const };
assert.equal(shouldUseLiveHeroFocal(contained), true);
assert.equal(heroDisplayUrl(contained, "desktop"), "https://cdn.example/orig.jpg");

const reset = resetHeroFocals(legacy);
assert.equal(reset.desktopFocal?.zoom, 1);
assert.equal(reset.mobileFocal?.zoom, 1);
assert.equal(reset.desktopUrl, undefined);
assert.equal(reset.mobileUrl, undefined);
assert.equal(zoomToSliderPercent(reset.desktopFocal!.zoom), 50);
assert.notEqual(reset.desktopFocal, reset.mobileFocal);

const vars = liveHeroFocalVars(fresh.desktopFocal, {
  x: 0.2,
  y: 0.8,
  zoom: 0.7,
});
assert.equal(vars["--hero-zoom-d"], "1");
assert.equal(vars["--hero-zoom-m"], "0.7");
assert.match(vars["--hero-pos-m"], /20% 80%/);

const field = readFileSync(
  join(process.cwd(), "components/admin/ResponsiveHeroImageField.tsx"),
  "utf8",
);
assert.match(field, /freshHeroImage/);
assert.match(field, /sliderPercentToZoom/);
assert.match(field, /min=\{0\}/);
assert.match(field, /max=\{100\}/);
assert.match(field, /dir="ltr"/);
assert.match(field, /heroAutoFit/);
assert.match(field, /hidePreview/);
assert.match(field, /csp-hero-focal-wrap/);
assert.doesNotMatch(field, /min=\{1\}/);
assert.doesNotMatch(field, /max=\{2\.2\}/);

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
assert.match(css, /grid-template-columns:\s*1fr 1fr/);
assert.match(css, /--csp-hero-preview-max:\s*200px/);
assert.match(css, /\.csp-hero-live/);
assert.match(css, /--hero-zoom-m/);

const publicHero = readFileSync(
  join(process.cwd(), "components/media/ResponsiveHeroImage.tsx"),
  "utf8",
);
assert.match(publicHero, /shouldUseLiveHeroFocal/);
assert.match(publicHero, /heroDisplayUrl/);
assert.match(publicHero, /liveHeroFocalVars/);

console.log("responsive-image zoom tests passed");

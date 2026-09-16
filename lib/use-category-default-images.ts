"use client";

import { useEffect, useMemo, useState } from "react";
import { useBranding } from "@/components/branding/BrandingProvider";
import { cachedJsonFetch, peekPublicCache, setPublicCache } from "@/lib/public-data-cache";
import { mergeCategoryDefaultImages } from "@/lib/product-images";
import type { CategoryDefaultImages } from "@/lib/types";

export const CATEGORY_DEFAULT_IMAGES_CACHE_KEY = "settings:public";

type PublicSettingsPayload = {
  settings?: {
    categoryDefaultImages?: CategoryDefaultImages;
  };
};

export function rememberCategoryDefaultImages(
  incoming?: CategoryDefaultImages | null,
) {
  const merged = mergeCategoryDefaultImages(incoming);
  if (!Object.keys(merged).length) return;
  const existing = peekPublicCache<PublicSettingsPayload>(
    CATEGORY_DEFAULT_IMAGES_CACHE_KEY,
    60_000,
    { allowStale: true },
  );
  setPublicCache(CATEGORY_DEFAULT_IMAGES_CACHE_KEY, {
    ...(existing || {}),
    settings: {
      ...(existing?.settings || {}),
      categoryDefaultImages: mergeCategoryDefaultImages({
        ...existing?.settings?.categoryDefaultImages,
        ...merged,
      }),
    },
  });
}

export function useCategoryDefaultImages(): CategoryDefaultImages {
  const { settings } = useBranding();
  const cached = peekPublicCache<PublicSettingsPayload>(
    CATEGORY_DEFAULT_IMAGES_CACHE_KEY,
    60_000,
    { allowStale: true },
  );
  const [fetched, setFetched] = useState<CategoryDefaultImages>(() =>
    mergeCategoryDefaultImages(cached?.settings?.categoryDefaultImages),
  );

  useEffect(() => {
    let cancelled = false;
    cachedJsonFetch<PublicSettingsPayload>(
      CATEGORY_DEFAULT_IMAGES_CACHE_KEY,
      "/api/settings",
      { ttlMs: 60_000 },
    )
      .then((data) => {
        if (cancelled) return;
        setFetched(
          mergeCategoryDefaultImages(data.settings?.categoryDefaultImages),
        );
        rememberCategoryDefaultImages(data.settings?.categoryDefaultImages);
      })
      .catch(() => {
        /* keep placeholder / last known defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () =>
      mergeCategoryDefaultImages({
        ...settings?.categoryDefaultImages,
        ...cached?.settings?.categoryDefaultImages,
        ...fetched,
      }),
    [settings?.categoryDefaultImages, cached, fetched],
  );
}

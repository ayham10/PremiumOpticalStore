"use client";

import { useEffect, useState } from "react";
import { cachedJsonFetch, peekPublicCache } from "@/lib/public-data-cache";
import { mergeCategoryDefaultImages } from "@/lib/product-images";
import type { CategoryDefaultImages } from "@/lib/types";

export const CATEGORY_DEFAULT_IMAGES_CACHE_KEY = "settings:public";

type PublicSettingsPayload = {
  settings?: {
    categoryDefaultImages?: CategoryDefaultImages;
  };
};

export function useCategoryDefaultImages(): CategoryDefaultImages {
  const cached = peekPublicCache<PublicSettingsPayload>(
    CATEGORY_DEFAULT_IMAGES_CACHE_KEY,
    60_000,
    { allowStale: true },
  );
  const [defaults, setDefaults] = useState<CategoryDefaultImages>(() =>
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
        setDefaults(
          mergeCategoryDefaultImages(data.settings?.categoryDefaultImages),
        );
      })
      .catch(() => {
        /* keep placeholder / last known defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return defaults;
}

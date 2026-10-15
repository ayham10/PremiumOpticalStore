/** Short public HTTP cache so newly saved translations appear quickly. */
export const PUBLIC_JSON_CACHE_CONTROL =
  "public, max-age=5, stale-while-revalidate=15";

/** Admin JSON must not be cached by the browser or CDN. */
export const PRIVATE_NO_STORE_CACHE_CONTROL = "private, no-store";

/** Browser catalogue TTL. Keep in sync with PUBLIC_JSON_CACHE_CONTROL. */
export const PUBLIC_CLIENT_TTL_MS = 15_000;

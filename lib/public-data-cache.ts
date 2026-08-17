/**
 * Lightweight in-browser cache for public catalogue and booking fetches.
 * Safe for client components only — never stores secrets.
 */

type CacheEntry<T> = {
  at: number;
  data: T;
  inflight?: Promise<T>;
};

const memory = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 90_000;

export function peekPublicCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
  opts?: { allowStale?: boolean },
): T | null {
  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (!hit || hit.data === undefined) return null;
  if (Date.now() - hit.at > ttlMs && !opts?.allowStale) return null;
  return hit.data;
}

export function setPublicCache<T>(key: string, data: T): void {
  memory.set(key, { at: Date.now(), data });
}

export function invalidatePublicCache(prefix?: string): void {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** Deduped fetch with short TTL. Concurrent callers share one in-flight request. */
export async function cachedJsonFetch<T>(
  key: string,
  url: string,
  opts?: { ttlMs?: number; init?: RequestInit; revalidate?: boolean },
): Promise<T> {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const existing = memory.get(key) as CacheEntry<T> | undefined;
  if (
    !opts?.revalidate &&
    existing &&
    existing.data !== undefined &&
    Date.now() - existing.at <= ttlMs
  ) {
    return existing.data;
  }
  if (existing?.inflight) return existing.inflight;

  const inflight = (async () => {
    const res = await fetch(url, {
      ...opts?.init,
      headers: {
        Accept: "application/json",
        ...(opts?.init?.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error || `Request failed (${res.status})`,
      );
    }
    const data = (await res.json()) as T;
    memory.set(key, { at: Date.now(), data });
    return data;
  })();

  memory.set(key, {
    at: existing?.at ?? 0,
    data: (existing?.data as T) ?? (undefined as T),
    inflight,
  });

  try {
    return await inflight;
  } catch (error) {
    if (existing?.data !== undefined) {
      memory.set(key, { at: existing.at, data: existing.data });
      return existing.data;
    }
    memory.delete(key);
    throw error;
  }
}

export function productsCacheKey(categories: string[]): string {
  return `products:${[...categories].sort().join(",")}`;
}

export function productSlugCacheKey(slug: string): string {
  return `product:${slug}`;
}

export function bookingDatesCacheKey(type: string): string {
  return `booking-dates:${type}`;
}

export function bookingTimesCacheKey(type: string, date: string): string {
  return `booking-times:${type}:${date}`;
}

export function bookingServicesCacheKey(locale: string): string {
  return `booking-services:${locale}`;
}

export function promotionsSlidesCacheKey(): string {
  return "promotions:slides";
}

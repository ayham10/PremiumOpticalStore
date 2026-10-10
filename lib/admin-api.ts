export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let body: unknown = null;
    try {
      body = (await res.json()) as { error?: string; message?: string };
      const parsed = body as { error?: string; message?: string };
      message = parsed.error || parsed.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

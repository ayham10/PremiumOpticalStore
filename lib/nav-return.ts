const RETURN_KEY = "oyon-nav-return";
const RESTORE_SCROLL_KEY = "oyon-nav-restore-scroll";

export type NavReturnPayload = {
  path: string;
  scroll: number;
};

export function saveNavReturn(path?: string, scroll?: number) {
  if (typeof window === "undefined") return;
  try {
    const payload: NavReturnPayload = {
      path: path ?? `${window.location.pathname}${window.location.search}`,
      scroll: scroll ?? window.scrollY,
    };
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readNavReturn(): NavReturnPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavReturnPayload;
    if (!parsed?.path || typeof parsed.scroll !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearNavReturn() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
}

export function stashScrollRestore(scroll: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESTORE_SCROLL_KEY, String(scroll));
  } catch {
    /* ignore */
  }
}

export function consumeScrollRestore(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESTORE_SCROLL_KEY);
    if (raw == null) return null;
    sessionStorage.removeItem(RESTORE_SCROLL_KEY);
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

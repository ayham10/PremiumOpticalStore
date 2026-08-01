type Nested = string | { [key: string]: Nested };

export function t(
  dict: Nested,
  path: string,
  vars?: Record<string, string | number>
): string {
  const parts = path.split(".");
  let cur: Nested | undefined = dict;
  for (const part of parts) {
    if (!cur || typeof cur === "string") return path;
    cur = cur[part];
  }
  if (typeof cur !== "string") return path;
  if (!vars) return cur;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    cur
  );
}

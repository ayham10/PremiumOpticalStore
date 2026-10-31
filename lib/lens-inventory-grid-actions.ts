import type { LensInventoryCell, LensInventoryCustomGrid } from "@/lib/types";
import type { LensGridAxis } from "@/lib/lens-inventory-grid";
import {
  addCustomAxisValue,
  axisHasStock,
  isCustomCyl,
  isCustomMinusSph,
  isCustomPlusSph,
  isDefaultCyl,
  isDefaultMinusSph,
  isDefaultPlusSph,
  migrateLensInventoryForAxisRename,
  normalizeLensInventoryCustomGrid,
  removeOrDeactivateCustomAxisValue,
  replaceCustomAxisValue,
  restoreDeactivatedCustomAxisValue,
  validateCustomAxisValue,
} from "@/lib/lens-inventory-grid";

export type LensGridMutation =
  | { action: "add"; axis: LensGridAxis; value: string }
  | { action: "edit"; axis: LensGridAxis; from: string; to: string }
  | { action: "delete"; axis: LensGridAxis; value: string }
  | { action: "restore"; axis: LensGridAxis; value: string };

export function parseLensGridMutationBody(
  body: unknown,
): { ok: true; mutation: LensGridMutation } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid grid payload" };
  }
  const raw = body as Record<string, unknown>;
  const action = raw.action;
  const axis = raw.axis;
  if (action !== "add" && action !== "edit" && action !== "delete" && action !== "restore") {
    return { ok: false, error: "Invalid action" };
  }
  if (axis !== "minusSph" && axis !== "plusSph" && axis !== "cyl") {
    return { ok: false, error: "Invalid axis" };
  }
  if (action === "add") {
    const value = typeof raw.value === "string" ? raw.value : "";
    if (!value.trim()) return { ok: false, error: "Value required" };
    return { ok: true, mutation: { action, axis, value } };
  }
  if (action === "edit") {
    const from = typeof raw.from === "string" ? raw.from.trim() : "";
    const to = typeof raw.to === "string" ? raw.to : "";
    if (!from || !to.trim()) return { ok: false, error: "From and to required" };
    return { ok: true, mutation: { action, axis, from, to } };
  }
  if (action === "restore") {
    const value = typeof raw.value === "string" ? raw.value.trim() : "";
    if (!value) return { ok: false, error: "Value required" };
    return { ok: true, mutation: { action, axis, value } };
  }
  const value = typeof raw.value === "string" ? raw.value.trim() : "";
  if (!value) return { ok: false, error: "Value required" };
  return { ok: true, mutation: { action, axis, value } };
}

function assertCustomOnly(
  axis: LensGridAxis,
  value: string,
  grid: LensInventoryCustomGrid,
): string | null {
  if (axis === "minusSph") {
    if (isDefaultMinusSph(value)) return "Default sizes cannot be changed";
    if (!isCustomMinusSph(value, grid)) return "Custom size not found";
    return null;
  }
  if (axis === "plusSph") {
    if (isDefaultPlusSph(value)) return "Default sizes cannot be changed";
    if (!isCustomPlusSph(value, grid)) return "Custom size not found";
    return null;
  }
  if (isDefaultCyl(value)) return "Default sizes cannot be changed";
  if (!isCustomCyl(value, grid)) return "Custom size not found";
  return null;
}

function assertDeactivatedOnly(
  axis: LensGridAxis,
  value: string,
  grid: LensInventoryCustomGrid,
): string | null {
  const listKey = axis;
  const hidden = grid.deactivated?.[listKey] ?? [];
  if (!hidden.includes(value)) return "Hidden size not found";
  if (axis === "minusSph" && isDefaultMinusSph(value)) return "Default sizes cannot be restored";
  if (axis === "plusSph" && isDefaultPlusSph(value)) return "Default sizes cannot be restored";
  if (axis === "cyl" && isDefaultCyl(value)) return "Default sizes cannot be restored";
  return null;
}

export function applyLensGridMutation(
  items: LensInventoryCell[],
  grid: LensInventoryCustomGrid,
  mutation: LensGridMutation,
  updatedAt: string,
): {
  items: LensInventoryCell[];
  grid: LensInventoryCustomGrid;
} {
  const currentGrid = normalizeLensInventoryCustomGrid(grid);
  if (mutation.action === "add") {
    const validated = validateCustomAxisValue(mutation.axis, mutation.value, currentGrid);
    if (!validated.ok) throw new Error(validated.error);
    return {
      items,
      grid: addCustomAxisValue(currentGrid, mutation.axis, validated.value),
    };
  }
  if (mutation.action === "edit") {
    const protectedError = assertCustomOnly(mutation.axis, mutation.from, currentGrid);
    if (protectedError) throw new Error(protectedError);
    const listKey =
      mutation.axis === "minusSph"
        ? "minusSph"
        : mutation.axis === "plusSph"
          ? "plusSph"
          : "cyl";
    const gridWithoutFrom: LensInventoryCustomGrid = {
      ...currentGrid,
      [listKey]: currentGrid[listKey].filter((v) => v !== mutation.from),
    };
    const validated = validateCustomAxisValue(
      mutation.axis,
      mutation.to,
      gridWithoutFrom,
    );
    if (!validated.ok) throw new Error(validated.error);
    return {
      items: migrateLensInventoryForAxisRename(
        items,
        mutation.axis,
        mutation.from,
        validated.value,
        updatedAt,
      ),
      grid: replaceCustomAxisValue(
        currentGrid,
        mutation.axis,
        mutation.from,
        validated.value,
      ),
    };
  }
  if (mutation.action === "restore") {
    const hiddenError = assertDeactivatedOnly(
      mutation.axis,
      mutation.value,
      currentGrid,
    );
    if (hiddenError) throw new Error(hiddenError);
    return {
      items,
      grid: restoreDeactivatedCustomAxisValue(
        currentGrid,
        mutation.axis,
        mutation.value,
      ),
    };
  }
  const protectedError = assertCustomOnly(mutation.axis, mutation.value, currentGrid);
  if (protectedError) throw new Error(protectedError);
  const hasStock = axisHasStock(items, mutation.axis, mutation.value);
  return {
    items,
    grid: removeOrDeactivateCustomAxisValue(
      currentGrid,
      mutation.axis,
      mutation.value,
      hasStock,
    ),
  };
}

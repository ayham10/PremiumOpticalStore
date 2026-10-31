import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_PLUS_SPH,
  LENS_SPH_ONLY_CYL,
  lensCellKey,
} from "@/lib/lens-inventory";
import type { LensInventoryCell, LensInventoryCustomGrid, LensInventorySign } from "@/lib/types";

export type LensGridAxis = "minusSph" | "plusSph" | "cyl";

const EMPTY_GRID: LensInventoryCustomGrid = {
  minusSph: [],
  plusSph: [],
  cyl: [],
  deactivated: { minusSph: [], plusSph: [], cyl: [] },
};

export function emptyLensInventoryCustomGrid(): LensInventoryCustomGrid {
  return {
    minusSph: [],
    plusSph: [],
    cyl: [],
    deactivated: { minusSph: [], plusSph: [], cyl: [] },
  };
}

export function normalizeLensInventoryCustomGrid(
  raw: unknown,
): LensInventoryCustomGrid {
  const base = emptyLensInventoryCustomGrid();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Record<string, unknown>;
  const readList = (key: string): string[] => {
    if (!Array.isArray(value[key])) return [];
    return [...new Set(value[key].filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))];
  };
  const deactivatedRaw = value.deactivated;
  const deactivated =
    deactivatedRaw && typeof deactivatedRaw === "object"
      ? {
          minusSph: readListFromObj(deactivatedRaw as Record<string, unknown>, "minusSph"),
          plusSph: readListFromObj(deactivatedRaw as Record<string, unknown>, "plusSph"),
          cyl: readListFromObj(deactivatedRaw as Record<string, unknown>, "cyl"),
        }
      : { minusSph: [], plusSph: [], cyl: [] };

  return {
    minusSph: readList("minusSph"),
    plusSph: readList("plusSph"),
    cyl: readList("cyl"),
    deactivated,
  };
}

function readListFromObj(obj: Record<string, unknown>, key: string): string[] {
  if (!Array.isArray(obj[key])) return [];
  return [...new Set(obj[key].filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))];
}

export function isDefaultMinusSph(sph: string): boolean {
  return (LENS_MINUS_SPH as readonly string[]).includes(sph);
}

export function isDefaultPlusSph(sph: string): boolean {
  return (LENS_PLUS_SPH as readonly string[]).includes(sph);
}

export function isDefaultCyl(cyl: string): boolean {
  return cyl === LENS_SPH_ONLY_CYL || (LENS_CYL as readonly string[]).includes(cyl);
}

export function isCustomMinusSph(sph: string, grid: LensInventoryCustomGrid): boolean {
  return grid.minusSph.includes(sph);
}

export function isCustomPlusSph(sph: string, grid: LensInventoryCustomGrid): boolean {
  return grid.plusSph.includes(sph);
}

export function isCustomCyl(cyl: string, grid: LensInventoryCustomGrid): boolean {
  return grid.cyl.includes(cyl);
}

/** Table order: PLANO, then least negative → most negative (matches default grid). */
function compareMinusSph(a: string, b: string): number {
  if (a === "PLANO") return -1;
  if (b === "PLANO") return 1;
  const na = Number.parseFloat(a);
  const nb = Number.parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a.localeCompare(b);
  return nb - na;
}

function plusSphSortKey(sph: string): number {
  const n = Number.parseFloat(sph);
  return Number.isFinite(n) ? n : 999;
}

/** Table order: spherical-only first, then least negative CYL → most negative. */
function compareCyl(a: string, b: string): number {
  if (a === LENS_SPH_ONLY_CYL) return -1;
  if (b === LENS_SPH_ONLY_CYL) return 1;
  const na = Number.parseFloat(a);
  const nb = Number.parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a.localeCompare(b);
  return nb - na;
}

function sortMinusSph(values: string[]): string[] {
  return [...new Set(values)].sort(compareMinusSph);
}

function sortPlusSph(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => plusSphSortKey(a) - plusSphSortKey(b));
}

function sortCyl(values: string[]): string[] {
  return [...new Set(values)].sort(compareCyl);
}

export function effectiveMinusSph(grid: LensInventoryCustomGrid = EMPTY_GRID): string[] {
  const activeCustom = grid.minusSph.filter(
    (sph) => !grid.deactivated?.minusSph?.includes(sph),
  );
  return sortMinusSph([...LENS_MINUS_SPH, ...activeCustom]);
}

export function effectivePlusSph(grid: LensInventoryCustomGrid = EMPTY_GRID): string[] {
  const activeCustom = grid.plusSph.filter(
    (sph) => !grid.deactivated?.plusSph?.includes(sph),
  );
  return sortPlusSph([...LENS_PLUS_SPH, ...activeCustom]);
}

export function effectiveCylColumns(grid: LensInventoryCustomGrid = EMPTY_GRID): string[] {
  const activeCustom = grid.cyl.filter((cyl) => !grid.deactivated?.cyl?.includes(cyl));
  return sortCyl([...LENS_CYL, ...activeCustom]);
}

export function effectiveCylSequence(grid: LensInventoryCustomGrid = EMPTY_GRID): string[] {
  return [LENS_SPH_ONLY_CYL, ...effectiveCylColumns(grid)];
}

export function isAllowedSphWithGrid(
  type: LensInventorySign,
  sph: string,
  grid: LensInventoryCustomGrid = EMPTY_GRID,
): boolean {
  if (type === "minus") {
    return isDefaultMinusSph(sph) || isCustomMinusSph(sph, grid);
  }
  return isDefaultPlusSph(sph) || isCustomPlusSph(sph, grid);
}

export function isAllowedCylWithGrid(
  cyl: string,
  grid: LensInventoryCustomGrid = EMPTY_GRID,
): boolean {
  if (cyl === LENS_SPH_ONLY_CYL) return true;
  return isDefaultCyl(cyl) || isCustomCyl(cyl, grid);
}

export function buildLensOrderRankMaps(grid: LensInventoryCustomGrid = EMPTY_GRID) {
  const cylSeq = effectiveCylSequence(grid);
  const minusSph = effectiveMinusSph(grid);
  const plusSph = effectivePlusSph(grid);
  return {
    cylOrder: new Map(cylSeq.map((cyl, index) => [cyl, index])),
    minusSphOrder: new Map(minusSph.map((sph, index) => [sph, index])),
    plusSphOrder: new Map(plusSph.map((sph, index) => [sph, index])),
  };
}

const MINUS_SPH_PATTERN = /^(PLANO|-\d+\.\d{2})$/;
const PLUS_SPH_PATTERN = /^\+?\d+\.\d{2}$/;
const CYL_PATTERN = /^-\d+\.\d{2}$/;

export function normalizeLensPowerInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === "PLANO") return "PLANO";
  if (/^\+/.test(trimmed) || /^\d/.test(trimmed)) {
    const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
    if (!PLUS_SPH_PATTERN.test(withPlus)) return null;
    const n = Number.parseFloat(withPlus);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `+${n.toFixed(2)}`;
  }
  if (trimmed.startsWith("-")) {
    if (!MINUS_SPH_PATTERN.test(trimmed)) return null;
    if (trimmed === "PLANO") return "PLANO";
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n) || n >= 0) return null;
    return n.toFixed(2);
  }
  return null;
}

export function normalizeCustomCylInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!CYL_PATTERN.test(trimmed)) return null;
  if (trimmed === LENS_SPH_ONLY_CYL) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n >= 0) return null;
  return n.toFixed(2);
}

/** Diopter values must land on 0.25 steps (PLANO exempt). */
export function isQuarterDiopterStep(value: string): boolean {
  if (value === "PLANO") return true;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return false;
  const quarters = Math.round(Math.abs(n) * 4);
  return Math.abs(Math.abs(n) * 4 - quarters) < 1e-6;
}

export type DeactivatedCustomSize = { axis: LensGridAxis; value: string };

export function listDeactivatedCustomSizes(
  grid: LensInventoryCustomGrid = EMPTY_GRID,
): DeactivatedCustomSize[] {
  const d = grid.deactivated ?? { minusSph: [], plusSph: [], cyl: [] };
  return [
    ...(d.minusSph ?? []).map((value) => ({ axis: "minusSph" as const, value })),
    ...(d.plusSph ?? []).map((value) => ({ axis: "plusSph" as const, value })),
    ...(d.cyl ?? []).map((value) => ({ axis: "cyl" as const, value })),
  ];
}

export function isDeactivatedCustomSize(
  axis: LensGridAxis,
  value: string,
  grid: LensInventoryCustomGrid = EMPTY_GRID,
): boolean {
  const listKey = axis;
  return (grid.deactivated?.[listKey] ?? []).includes(value);
}

export function validateCustomAxisValue(
  axis: LensGridAxis,
  value: string,
  grid: LensInventoryCustomGrid,
): { ok: true; value: string } | { ok: false; error: string } {
  if (axis === "cyl") {
    const cyl = normalizeCustomCylInput(value);
    if (!cyl) return { ok: false, error: "Invalid CYL value" };
    if (!isQuarterDiopterStep(cyl)) return { ok: false, error: "Use 0.25 steps only" };
    if (isDefaultCyl(cyl)) return { ok: false, error: "CYL already exists" };
    if (grid.cyl.includes(cyl)) return { ok: false, error: "Duplicate CYL" };
    if (isDeactivatedCustomSize("cyl", cyl, grid)) {
      return { ok: false, error: "CYL is hidden; restore it instead" };
    }
    return { ok: true, value: cyl };
  }
  if (axis === "minusSph") {
    const sph = normalizeLensPowerInput(value);
    if (!sph || sph.startsWith("+")) return { ok: false, error: "Invalid minus SPH" };
    if (!isQuarterDiopterStep(sph)) return { ok: false, error: "Use 0.25 steps only" };
    if (isDefaultMinusSph(sph)) return { ok: false, error: "SPH already exists" };
    if (grid.minusSph.includes(sph)) return { ok: false, error: "Duplicate SPH" };
    if (isDeactivatedCustomSize("minusSph", sph, grid)) {
      return { ok: false, error: "SPH is hidden; restore it instead" };
    }
    return { ok: true, value: sph };
  }
  const sph = normalizeLensPowerInput(value);
  if (!sph || sph === "PLANO" || !sph.startsWith("+")) {
    return { ok: false, error: "Invalid plus SPH" };
  }
  if (!isQuarterDiopterStep(sph)) return { ok: false, error: "Use 0.25 steps only" };
  if (isDefaultPlusSph(sph)) return { ok: false, error: "SPH already exists" };
  if (grid.plusSph.includes(sph)) return { ok: false, error: "Duplicate SPH" };
  if (isDeactivatedCustomSize("plusSph", sph, grid)) {
    return { ok: false, error: "SPH is hidden; restore it instead" };
  }
  return { ok: true, value: sph };
}

export function axisHasStock(
  items: LensInventoryCell[],
  axis: LensGridAxis,
  value: string,
): boolean {
  return items.some((item) => {
    if (axis === "minusSph") {
      return item.type === "minus" && item.sph === value && (item.currentStock > 0 || item.desiredStock > 0);
    }
    if (axis === "plusSph") {
      return item.type === "plus" && item.sph === value && (item.currentStock > 0 || item.desiredStock > 0);
    }
    return item.cyl === value && (item.currentStock > 0 || item.desiredStock > 0);
  });
}

/** Any saved inventory cell on this axis (including zero qty). */
export function axisHasInventoryRecords(
  items: LensInventoryCell[],
  axis: LensGridAxis,
  value: string,
): boolean {
  return items.some((item) => {
    if (axis === "minusSph") return item.type === "minus" && item.sph === value;
    if (axis === "plusSph") return item.type === "plus" && item.sph === value;
    return item.cyl === value;
  });
}

export function purgeLensInventoryCellsForAxis(
  items: LensInventoryCell[],
  axis: LensGridAxis,
  value: string,
): LensInventoryCell[] {
  return items.filter((item) => {
    if (axis === "minusSph") return !(item.type === "minus" && item.sph === value);
    if (axis === "plusSph") return !(item.type === "plus" && item.sph === value);
    return item.cyl !== value;
  });
}

export function migrateLensInventoryForAxisRename(
  items: LensInventoryCell[],
  axis: LensGridAxis,
  from: string,
  to: string,
  updatedAt: string,
): LensInventoryCell[] {
  const map = new Map<string, LensInventoryCell>();
  for (const item of items) {
    let { type, sph, cyl } = item;
    if (axis === "minusSph" && type === "minus" && sph === from) sph = to;
    if (axis === "plusSph" && type === "plus" && sph === from) sph = to;
    if (axis === "cyl" && cyl === from) cyl = to;
    const key = lensCellKey(type, sph, cyl);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        currentStock: existing.currentStock + item.currentStock,
        desiredStock: existing.desiredStock + item.desiredStock,
        updatedAt,
      });
    } else {
      map.set(key, { ...item, sph, cyl, updatedAt });
    }
  }
  return [...map.values()];
}

export function addCustomAxisValue(
  grid: LensInventoryCustomGrid,
  axis: LensGridAxis,
  value: string,
): LensInventoryCustomGrid {
  const next = normalizeLensInventoryCustomGrid(grid);
  const listKey = axis;
  if (next[listKey].includes(value)) return next;
  next[listKey] = sortAxisList(axis, [...next[listKey], value]);
  next.deactivated = next.deactivated ?? { minusSph: [], plusSph: [], cyl: [] };
  const deactivatedList = next.deactivated[listKey] ?? [];
  next.deactivated[listKey] = deactivatedList.filter((v) => v !== value);
  return next;
}

function sortAxisList(axis: LensGridAxis, values: string[]): string[] {
  if (axis === "minusSph") return sortMinusSph(values);
  if (axis === "plusSph") return sortPlusSph(values);
  return sortCyl(values);
}

export function replaceCustomAxisValue(
  grid: LensInventoryCustomGrid,
  axis: LensGridAxis,
  from: string,
  to: string,
): LensInventoryCustomGrid {
  const next = normalizeLensInventoryCustomGrid(grid);
  const listKey = axis;
  next[listKey] = sortAxisList(
    axis,
    next[listKey].map((v) => (v === from ? to : v)),
  );
  return next;
}

export function removeOrDeactivateCustomAxisValue(
  grid: LensInventoryCustomGrid,
  axis: LensGridAxis,
  value: string,
  hasStock: boolean,
): LensInventoryCustomGrid {
  const next = normalizeLensInventoryCustomGrid(grid);
  const listKey = axis;
  next[listKey] = next[listKey].filter((v) => v !== value);
  next.deactivated = next.deactivated ?? { minusSph: [], plusSph: [], cyl: [] };
  if (hasStock) {
    const deactivated = new Set(next.deactivated[listKey] ?? []);
    deactivated.add(value);
    next.deactivated[listKey] = [...deactivated];
  }
  return next;
}

export function restoreDeactivatedCustomAxisValue(
  grid: LensInventoryCustomGrid,
  axis: LensGridAxis,
  value: string,
): LensInventoryCustomGrid {
  const next = normalizeLensInventoryCustomGrid(grid);
  const listKey = axis;
  next.deactivated = next.deactivated ?? { minusSph: [], plusSph: [], cyl: [] };
  const hidden = next.deactivated[listKey] ?? [];
  if (!hidden.includes(value)) {
    throw new Error("Hidden size not found");
  }
  next.deactivated[listKey] = hidden.filter((v) => v !== value);
  if (!next[listKey].includes(value)) {
    next[listKey] = sortAxisList(axis, [...next[listKey], value]);
  }
  return next;
}

import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_PLUS_SPH,
  LENS_SPH_ONLY_CYL,
  getLensCell,
  isAllowedCyl,
  isAllowedSph,
  isLensInventorySign,
  lensCellKey,
  parseLensQty,
  upsertLensInventoryCell,
} from "@/lib/lens-inventory";
import type { LensInventoryCell, LensInventorySign } from "@/lib/types";

export const LENS_QTY_MAX = 9999;

export type LensEditField = "current" | "desired";

export type LensGridCoord = {
  type: LensInventorySign;
  row: number;
  col: number;
};

export type LensPasteValue = {
  currentStock?: number;
  desiredStock?: number;
};

export type LensDraft = {
  currentStock: number;
  desiredStock: number;
};

export type LensDraftMap = Record<string, LensDraft>;

export type LensWriteItem = {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  currentStock: number;
  desiredStock: number;
  expectedUpdatedAt: string | null;
};

const TABLES: LensInventorySign[] = ["minus", "plus"];

export function lensSphsFor(type: LensInventorySign): readonly string[] {
  return type === "minus" ? LENS_MINUS_SPH : LENS_PLUS_SPH;
}

export function lensCyls(): readonly string[] {
  return [LENS_SPH_ONLY_CYL, ...LENS_CYL];
}

export function lensCoordToCell(coord: LensGridCoord): {
  type: LensInventorySign;
  sph: string;
  cyl: string;
} | null {
  const sphs = lensSphsFor(coord.type);
  const cyls = lensCyls();
  const sph = sphs[coord.row];
  const cyl = cyls[coord.col];
  if (!sph || !cyl) return null;
  return { type: coord.type, sph, cyl };
}

export function lensCellToCoord(
  type: LensInventorySign,
  sph: string,
  cyl: string,
): LensGridCoord | null {
  const row = lensSphsFor(type).indexOf(sph);
  const col = lensCyls().indexOf(cyl);
  if (row < 0 || col < 0) return null;
  return { type, row, col };
}

export function moveLensCoord(
  coord: LensGridCoord,
  dRow: number,
  dCol: number,
): LensGridCoord | null {
  const next = { ...coord, row: coord.row + dRow, col: coord.col + dCol };
  const sphs = lensSphsFor(next.type);
  const cyls = lensCyls();
  if (next.row < 0 || next.row >= sphs.length) return null;
  if (next.col < 0 || next.col >= cyls.length) return null;
  return next;
}

export function lensArrowFieldSwitch(
  field: LensEditField,
  key: "ArrowLeft" | "ArrowRight",
  selectionStart: number,
  selectionEnd: number,
  valueLength: number,
): LensEditField | null {
  if (selectionStart !== selectionEnd) return null;
  if (key === "ArrowRight" && field === "current" && selectionStart === valueLength) {
    return "desired";
  }
  if (key === "ArrowLeft" && field === "desired" && selectionStart === 0) {
    return "current";
  }
  return null;
}

export function tabLensCoord(
  coord: LensGridCoord,
  reverse = false,
): LensGridCoord | null {
  const cylCount = lensCyls().length;
  const step = reverse ? -1 : 1;
  let typeIndex = TABLES.indexOf(coord.type);
  let row = coord.row;
  let col = coord.col + step;

  for (let guard = 0; guard < 800; guard += 1) {
    const sphs = lensSphsFor(TABLES[typeIndex]);
    if (col >= 0 && col < cylCount && row >= 0 && row < sphs.length) {
      return { type: TABLES[typeIndex], row, col };
    }
    if (!reverse) {
      if (col >= cylCount) {
        col = 0;
        row += 1;
      }
      if (row >= sphs.length) {
        typeIndex += 1;
        if (typeIndex >= TABLES.length) return null;
        row = 0;
        col = 0;
      }
    } else {
      if (col < 0) {
        row -= 1;
        col = cylCount - 1;
      }
      if (row < 0) {
        typeIndex -= 1;
        if (typeIndex < 0) return null;
        row = lensSphsFor(TABLES[typeIndex]).length - 1;
        col = cylCount - 1;
      }
    }
  }
  return null;
}

export function parseLensQtyInput(value: unknown): number | null {
  const parsed = parseLensQty(value);
  if (parsed == null || parsed > LENS_QTY_MAX) return null;
  return parsed;
}

export function parseLensPasteToken(token: string): LensPasteValue | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const pair = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pair) {
    const currentStock = parseLensQtyInput(pair[1]);
    const desiredStock = parseLensQtyInput(pair[2]);
    if (currentStock == null || desiredStock == null) return null;
    return { currentStock, desiredStock };
  }
  const currentStock = parseLensQtyInput(trimmed);
  if (currentStock == null) return null;
  return { currentStock };
}

export function parseLensPasteGrid(text: string): Array<Array<LensPasteValue | null>> {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.split("\n");
  while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
  if (!rows.length) return [];
  return rows.map((row) => {
    const delimiter = row.includes("\t") ? "\t" : row.includes(";") ? ";" : ",";
    const cells =
      row.includes("\t") || row.includes(";") || /,\s*\d/.test(row)
        ? row.split(delimiter)
        : [row];
    return cells.map((cell) => parseLensPasteToken(cell));
  });
}

export function viewedLensCell(
  items: LensInventoryCell[],
  drafts: LensDraftMap,
  type: LensInventorySign,
  sph: string,
  cyl: string,
): { currentStock: number; desiredStock: number } {
  const draft = drafts[lensCellKey(type, sph, cyl)];
  if (draft) return draft;
  return getLensCell(items, type, sph, cyl);
}

export function viewedLensItems(
  items: LensInventoryCell[],
  drafts: LensDraftMap,
): LensInventoryCell[] {
  let next = items.map((item) => {
    const draft = drafts[lensCellKey(item.type, item.sph, item.cyl)];
    return draft ? { ...item, ...draft } : item;
  });
  for (const [key, draft] of Object.entries(drafts)) {
    const [type, sph, cyl] = key.split(":");
    if (!isLensInventorySign(type) || !sph || !cyl) continue;
    if (next.some((item) => lensCellKey(item.type, item.sph, item.cyl) === key)) {
      continue;
    }
    next = upsertLensInventoryCell(next, {
      type,
      sph,
      cyl,
      currentStock: draft.currentStock,
      desiredStock: draft.desiredStock,
      updatedAt: new Date(0).toISOString(),
    });
  }
  return next;
}

export function setLensDraft(
  drafts: LensDraftMap,
  items: LensInventoryCell[],
  type: LensInventorySign,
  sph: string,
  cyl: string,
  patch: Partial<LensDraft>,
): LensDraftMap {
  const current = viewedLensCell(items, drafts, type, sph, cyl);
  const next: LensDraft = {
    currentStock: patch.currentStock ?? current.currentStock,
    desiredStock: patch.desiredStock ?? current.desiredStock,
  };
  const saved = getLensCell(items, type, sph, cyl);
  const key = lensCellKey(type, sph, cyl);
  if (
    next.currentStock === saved.currentStock &&
    next.desiredStock === saved.desiredStock
  ) {
    if (!(key in drafts)) return drafts;
    const copy = { ...drafts };
    delete copy[key];
    return copy;
  }
  return { ...drafts, [key]: next };
}

export function applyLensPaste(
  drafts: LensDraftMap,
  items: LensInventoryCell[],
  origin: LensGridCoord,
  grid: Array<Array<LensPasteValue | null>>,
): LensDraftMap {
  let next = drafts;
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    for (let c = 0; c < row.length; c += 1) {
      const value = row[c];
      if (!value) continue;
      const coord = moveLensCoord(origin, r, c);
      const cell = coord ? lensCoordToCell(coord) : null;
      if (!cell) continue;
      next = setLensDraft(next, items, cell.type, cell.sph, cell.cyl, value);
    }
  }
  return next;
}

export function lensDraftCount(drafts: LensDraftMap): number {
  return Object.keys(drafts).length;
}

export function cellExpectedUpdatedAt(
  items: LensInventoryCell[],
  type: LensInventorySign,
  sph: string,
  cyl: string,
): string {
  return (
    items.find((item) => item.type === type && item.sph === sph && item.cyl === cyl)
      ?.updatedAt ?? ""
  );
}

export function draftsToWriteItems(
  items: LensInventoryCell[],
  drafts: LensDraftMap,
): LensWriteItem[] {
  const writes: LensWriteItem[] = [];
  for (const [key, draft] of Object.entries(drafts)) {
    const [type, sph, cyl] = key.split(":");
    if (!isLensInventorySign(type) || !sph || !cyl) continue;
    writes.push({
      type,
      sph,
      cyl,
      currentStock: draft.currentStock,
      desiredStock: draft.desiredStock,
      expectedUpdatedAt: cellExpectedUpdatedAt(items, type, sph, cyl),
    });
  }
  return writes;
}

export class LensInventoryConflictError extends Error {
  conflicts: Array<{ type: LensInventorySign; sph: string; cyl: string }>;
  constructor(
    conflicts: Array<{ type: LensInventorySign; sph: string; cyl: string }>,
  ) {
    super("LENS_INVENTORY_CONFLICT");
    this.name = "LensInventoryConflictError";
    this.conflicts = conflicts;
  }
}

export function findLensWriteConflicts(
  storeItems: LensInventoryCell[],
  writes: LensWriteItem[],
): Array<{ type: LensInventorySign; sph: string; cyl: string }> {
  const conflicts: Array<{ type: LensInventorySign; sph: string; cyl: string }> = [];
  for (const write of writes) {
    if (write.expectedUpdatedAt == null) continue;
    const actual = cellExpectedUpdatedAt(
      storeItems,
      write.type,
      write.sph,
      write.cyl,
    );
    if (actual !== write.expectedUpdatedAt) {
      conflicts.push({ type: write.type, sph: write.sph, cyl: write.cyl });
    }
  }
  return conflicts;
}

export function applyLensWrites(
  storeItems: LensInventoryCell[],
  writes: LensWriteItem[],
  updatedAt: string,
): LensInventoryCell[] {
  let next = storeItems;
  for (const write of writes) {
    next = upsertLensInventoryCell(next, {
      type: write.type,
      sph: write.sph,
      cyl: write.cyl,
      currentStock: write.currentStock,
      desiredStock: write.desiredStock,
      updatedAt,
    });
  }
  return next;
}

export function parseLensInventoryWriteBody(
  body: unknown,
): { ok: true; items: LensWriteItem[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid lens payload" };
  }
  const raw = body as Record<string, unknown>;
  const rows = Array.isArray(raw.items) ? raw.items : [raw];
  if (!rows.length) return { ok: false, error: "Invalid lens payload" };
  const items: LensWriteItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Invalid lens payload" };
    }
    const value = row as Record<string, unknown>;
    if (!isLensInventorySign(value.type)) {
      return { ok: false, error: "Invalid lens type" };
    }
    const sph = typeof value.sph === "string" ? value.sph.trim() : "";
    const cyl = typeof value.cyl === "string" ? value.cyl.trim() : "";
    if (!isAllowedSph(value.type, sph) || !isAllowedCyl(cyl)) {
      return { ok: false, error: "Invalid SPH or CYL" };
    }
    const currentStock = parseLensQtyInput(value.currentStock);
    const desiredStock = parseLensQtyInput(value.desiredStock);
    if (currentStock == null || desiredStock == null) {
      return { ok: false, error: "Stock values must be whole numbers of 0 or more" };
    }
    const expectedUpdatedAt =
      typeof value.expectedUpdatedAt === "string" ? value.expectedUpdatedAt : null;
    items.push({
      type: value.type,
      sph,
      cyl,
      currentStock,
      desiredStock,
      expectedUpdatedAt,
    });
  }
  return { ok: true, items };
}

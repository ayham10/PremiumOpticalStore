import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_PLUS_SPH,
  LENS_SPH_ONLY_CYL,
  buildLensOrderRows,
  lensCellKey,
} from "../lib/lens-inventory";
import {
  applyLensPaste,
  applyLensWrites,
  draftsToWriteItems,
  findLensWriteConflicts,
  lensCyls,
  lensDraftCount,
  moveLensCoord,
  moveLensEditTarget,
  parseLensInventoryWriteBody,
  parseLensPasteGrid,
  parseLensPasteToken,
  parseLensQtyInput,
  setLensDraft,
  tabLensCoord,
  viewedLensCell,
  viewedLensItems,
} from "../lib/lens-inventory-edit";
import type { LensInventoryCell } from "../lib/types";

assert.equal(parseLensQtyInput("0"), 0);
assert.equal(parseLensQtyInput("12"), 12);
assert.equal(parseLensQtyInput("9999"), 9999);
assert.equal(parseLensQtyInput("10000"), null);
assert.equal(parseLensQtyInput("-1"), null);
assert.equal(parseLensQtyInput("1.5"), null);
assert.equal(parseLensQtyInput(""), null);

assert.deepEqual(parseLensPasteToken("7"), { currentStock: 7 });
assert.deepEqual(parseLensPasteToken("3/5"), {
  currentStock: 3,
  desiredStock: 5,
});
assert.deepEqual(parseLensPasteToken(" 4 / 8 "), {
  currentStock: 4,
  desiredStock: 8,
});
assert.equal(parseLensPasteToken("abc"), null);

const grid = parseLensPasteGrid("1\t2\t3\n4\t5/9\t6\n");
assert.deepEqual(grid, [
  [{ currentStock: 1 }, { currentStock: 2 }, { currentStock: 3 }],
  [
    { currentStock: 4 },
    { currentStock: 5, desiredStock: 9 },
    { currentStock: 6 },
  ],
]);
assert.deepEqual(parseLensPasteGrid("12\n"), [[{ currentStock: 12 }]]);
assert.deepEqual(parseLensPasteGrid("1;2;3"), [
  [{ currentStock: 1 }, { currentStock: 2 }, { currentStock: 3 }],
]);

const origin = { type: "minus" as const, row: 1, col: 0 };
assert.deepEqual(moveLensCoord(origin, 0, 1), {
  type: "minus",
  row: 1,
  col: 1,
});
assert.equal(moveLensCoord(origin, -2, 0), null);
assert.equal(lensCyls()[0], LENS_SPH_ONLY_CYL);
assert.equal(lensCyls().length, LENS_CYL.length + 1);

const firstMinus = { type: "minus" as const, row: 0, col: 0 };
const next = tabLensCoord(firstMinus);
assert.deepEqual(next, { type: "minus", row: 0, col: 1 });
const lastMinusCol = {
  type: "minus" as const,
  row: 0,
  col: lensCyls().length - 1,
};
assert.deepEqual(tabLensCoord(lastMinusCol), { type: "minus", row: 1, col: 0 });
const lastMinus = {
  type: "minus" as const,
  row: LENS_MINUS_SPH.length - 1,
  col: lensCyls().length - 1,
};
assert.deepEqual(tabLensCoord(lastMinus), { type: "plus", row: 0, col: 0 });
const lastPlus = {
  type: "plus" as const,
  row: LENS_PLUS_SPH.length - 1,
  col: lensCyls().length - 1,
};
assert.equal(tabLensCoord(lastPlus), null);
assert.deepEqual(tabLensCoord({ type: "plus", row: 0, col: 0 }, true), lastMinus);

const arrowAt = { type: "minus" as const, row: 1, col: 1 };
assert.deepEqual(moveLensEditTarget(arrowAt, "current", "ArrowRight"), {
  coord: arrowAt,
  field: "desired",
});
assert.deepEqual(moveLensEditTarget(arrowAt, "desired", "ArrowRight"), {
  coord: { type: "minus", row: 1, col: 2 },
  field: "current",
});
assert.deepEqual(moveLensEditTarget(arrowAt, "desired", "ArrowLeft"), {
  coord: arrowAt,
  field: "current",
});
assert.deepEqual(moveLensEditTarget(arrowAt, "current", "ArrowLeft"), {
  coord: { type: "minus", row: 1, col: 0 },
  field: "desired",
});
assert.deepEqual(moveLensEditTarget(arrowAt, "desired", "ArrowDown"), {
  coord: { type: "minus", row: 2, col: 1 },
  field: "desired",
});
assert.deepEqual(moveLensEditTarget(arrowAt, "current", "ArrowUp"), {
  coord: { type: "minus", row: 0, col: 1 },
  field: "current",
});
assert.equal(
  moveLensEditTarget({ type: "minus", row: 0, col: 0 }, "current", "ArrowLeft"),
  null,
);
assert.equal(
  moveLensEditTarget({ type: "minus", row: 0, col: 0 }, "current", "ArrowUp"),
  null,
);
assert.equal(
  moveLensEditTarget(
    { type: "minus", row: 0, col: lensCyls().length - 1 },
    "desired",
    "ArrowRight",
  ),
  null,
);
assert.deepEqual(
  moveLensEditTarget(arrowAt, "desired", "ArrowRight", false),
  { coord: { type: "minus", row: 1, col: 0 }, field: "current" },
);

const saved: LensInventoryCell[] = [
  {
    type: "minus",
    sph: "-0.25",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 1,
    desiredStock: 4,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
let drafts = setLensDraft({}, saved, "minus", "-0.25", LENS_SPH_ONLY_CYL, {
  currentStock: 3,
});
assert.deepEqual(viewedLensCell(saved, drafts, "minus", "-0.25", LENS_SPH_ONLY_CYL), {
  currentStock: 3,
  desiredStock: 4,
});
assert.equal(lensDraftCount(drafts), 1);

drafts = applyLensPaste(
  drafts,
  saved,
  { type: "minus", row: 1, col: 0 },
  parseLensPasteGrid("8\t9\n"),
);
assert.equal(
  viewedLensCell(saved, drafts, "minus", "-0.25", LENS_SPH_ONLY_CYL).currentStock,
  8,
);
assert.equal(
  viewedLensCell(saved, drafts, "minus", "-0.25", "-0.25").currentStock,
  9,
);
assert.equal(
  viewedLensCell(saved, drafts, "minus", "-0.25", "-0.25").desiredStock,
  0,
);

const viewed = viewedLensItems(saved, drafts);
const order = buildLensOrderRows(viewed);
assert.deepEqual(
  viewedLensCell(saved, drafts, "minus", "-0.25", LENS_SPH_ONLY_CYL),
  { currentStock: 8, desiredStock: 4 },
);
assert.equal(
  order.some(
    (row) =>
      row.type === "minus" &&
      row.sph === "-0.25" &&
      row.cyl === LENS_SPH_ONLY_CYL,
  ),
  false,
);
drafts = setLensDraft(drafts, saved, "minus", "-0.25", LENS_SPH_ONLY_CYL, {
  currentStock: 2,
  desiredStock: 5,
});
const orderAfter = buildLensOrderRows(viewedLensItems(saved, drafts));
assert.ok(
  orderAfter.some(
    (row) =>
      row.type === "minus" &&
      row.sph === "-0.25" &&
      row.cyl === LENS_SPH_ONLY_CYL &&
      row.currentStock === 2 &&
      row.desiredStock === 5 &&
      row.quantityToOrder === 3,
  ),
);

const writes = draftsToWriteItems(saved, drafts);
assert.ok(
  writes.some(
    (item) =>
      item.sph === "-0.25" &&
      item.cyl === LENS_SPH_ONLY_CYL &&
      item.expectedUpdatedAt === "2026-01-01T00:00:00.000Z",
  ),
);
assert.ok(
  writes.some(
    (item) => item.cyl === "-0.25" && item.expectedUpdatedAt === "",
  ),
);

assert.deepEqual(findLensWriteConflicts(saved, writes), []);
assert.equal(
  findLensWriteConflicts(
    [
      {
        ...saved[0],
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ],
    writes.filter((item) => item.cyl === LENS_SPH_ONLY_CYL),
  ).length,
  1,
);

const applied = applyLensWrites(saved, writes, "2026-03-03T00:00:00.000Z");
assert.equal(
  applied.find((item) => item.cyl === LENS_SPH_ONLY_CYL)?.currentStock,
  2,
);
assert.equal(applied.find((item) => item.cyl === "-0.25")?.currentStock, 9);

const parsedSingle = parseLensInventoryWriteBody({
  type: "plus",
  sph: "+1.00",
  cyl: "-0.50",
  currentStock: 2,
  desiredStock: 6,
});
assert.equal(parsedSingle.ok, true);
if (parsedSingle.ok) {
  assert.equal(parsedSingle.items.length, 1);
  assert.equal(parsedSingle.items[0].expectedUpdatedAt, null);
}

const parsedBulk = parseLensInventoryWriteBody({
  items: [
    {
      type: "minus",
      sph: "PLANO",
      cyl: LENS_SPH_ONLY_CYL,
      currentStock: 1,
      desiredStock: 2,
      expectedUpdatedAt: "t1",
    },
    {
      type: "plus",
      sph: "+0.25",
      cyl: "-1.00",
      currentStock: 0,
      desiredStock: 3,
      expectedUpdatedAt: "",
    },
  ],
});
assert.equal(parsedBulk.ok, true);
if (parsedBulk.ok) assert.equal(parsedBulk.items.length, 2);

assert.equal(parseLensInventoryWriteBody({ type: "nope" }).ok, false);
assert.equal(
  parseLensInventoryWriteBody({
    type: "minus",
    sph: "-1.00",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 1.5,
    desiredStock: 1,
  }).ok,
  false,
);

const page = readFileSync("app/admin/lens-inventory/page.tsx", "utf8");
assert.match(page, /commitActive/);
assert.match(page, /applyLensPaste/);
assert.match(page, /Save Changes|saveChanges/);
assert.match(page, /tabLensCoord/);
assert.doesNotMatch(page, /AdminModal/);
assert.match(page, /draftsToWriteItems/);
assert.match(page, /beforeunload/);
assert.match(page, /onClick=\{\(\) => onActivate\(type, sph, cyl, "current"\)\}/);
assert.match(page, /onDoubleClick=\{\(\) => onActivate\(type, sph, cyl, "desired"\)\}/);
assert.match(page, /undoChanges/);
assert.match(page, /cancelAll/);
assert.match(page, /moveLensEditTarget/);
assert.match(page, /orderOpen/);
assert.match(page, /ChevronDown/);
assert.match(page, /dir="ltr"/);
assert.match(page, /admin-lens-order-toggle/);
assert.match(page, /downloadLensOrderPdf/);
assert.doesNotMatch(page, /oyon-lens-order-\$\{stamp\}\.html/);
assert.doesNotMatch(page, /text\/html;charset=utf-8/);
assert.match(page, /admin-lens-order-section/);
assert.match(page, /buildLensOrderDisplayItems/);

const pdfDownload = readFileSync("lib/lens-order-pdf-download.ts", "utf8");
assert.match(pdfDownload, /application\/pdf/);
assert.match(pdfDownload, /filename/);
assert.doesNotMatch(page, /admin\.lensInventory\.colType/);
assert.match(page, /event\.preventDefault\(\);\s*if \(!coord\) return;/);

const css = readFileSync("app/globals.css", "utf8");
assert.match(css, /max-height: 17\.2rem/);
assert.match(css, /\.admin-lens-order th \{\s*position: sticky;/);
assert.match(css, /padding: 0\.35rem 0\.4rem/);
assert.match(css, /width: max-content/);

const route = readFileSync("app/api/lens-inventory/route.ts", "utf8");
assert.match(route, /parseLensInventoryWriteBody/);
assert.match(route, /findLensWriteConflicts/);
assert.match(route, /LENS_INVENTORY_CONFLICT/);
assert.match(route, /upsertLensInventoryCell|applyLensWrites/);

assert.equal(lensCellKey("minus", "-0.25", LENS_SPH_ONLY_CYL), "minus:-0.25:0.00");

console.log(
  JSON.stringify({
    isolated: "pass",
    inlineNoModal: true,
    paste: true,
    keyboard: true,
    bulkConflict: true,
    orderUpdatesFromDrafts: true,
  }),
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildLensOrderRows,
  LENS_MINUS_SPH,
  normalizeLensInventory,
  upsertLensInventoryCell,
} from "../lib/lens-inventory";
import { applyLensGridMutation } from "../lib/lens-inventory-grid-actions";
import {
  addCustomAxisValue,
  effectiveMinusSph,
  emptyLensInventoryCustomGrid,
  isCustomMinusSph,
  isDefaultMinusSph,
  migrateLensInventoryForAxisRename,
  removeOrDeactivateCustomAxisValue,
  restoreDeactivatedCustomAxisValue,
  validateCustomAxisValue,
} from "../lib/lens-inventory-grid";
import { lensSphsFor } from "../lib/lens-inventory-edit";

assert.ok(isDefaultMinusSph("PLANO"));
assert.ok(!isDefaultMinusSph("-5.00"));

const grid = emptyLensInventoryCustomGrid();
const added = addCustomAxisValue(grid, "minusSph", "-5.00");
assert.ok(isCustomMinusSph("-5.00", added));
const minusList = effectiveMinusSph(added);
assert.ok(minusList.includes("-5.00"));
assert.ok(minusList.indexOf("-5.00") > minusList.indexOf("-4.50"));

const validate = validateCustomAxisValue("minusSph", "-5.00", grid);
assert.equal(validate.ok, true);

const dup = validateCustomAxisValue("minusSph", "PLANO", grid);
assert.equal(dup.ok, false);

const items = normalizeLensInventory(
  [
    {
      type: "minus",
      sph: "-5.00",
      cyl: "0.00",
      currentStock: 2,
      desiredStock: 5,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  added,
);
assert.equal(items.length, 1);

const renamed = applyLensGridMutation(
  items,
  added,
  { action: "edit", axis: "minusSph", from: "-5.00", to: "-5.25" },
  "2026-01-02T00:00:00.000Z",
);
assert.ok(isCustomMinusSph("-5.25", renamed.grid));
assert.equal(renamed.items[0]?.sph, "-5.25");

const orderRows = buildLensOrderRows(
  upsertLensInventoryCell([], {
    type: "minus",
    sph: "-5.25",
    cyl: "-0.25",
    currentStock: 0,
    desiredStock: 3,
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  renamed.grid,
);
assert.equal(orderRows.length, 1);
assert.equal(orderRows[0]?.sph, "-5.25");

assert.equal(lensSphsFor("minus", renamed.grid).length, LENS_MINUS_SPH.length + 1);

const deactivated = removeOrDeactivateCustomAxisValue(added, "minusSph", "-5.00", true);
assert.ok(deactivated.deactivated?.minusSph?.includes("-5.00"));
assert.ok(!effectiveMinusSph(deactivated).includes("-5.00"));

const restored = restoreDeactivatedCustomAxisValue(deactivated, "minusSph", "-5.00");
assert.ok(effectiveMinusSph(restored).includes("-5.00"));
assert.ok(!restored.deactivated?.minusSph?.includes("-5.00"));

assert.equal(validateCustomAxisValue("minusSph", "-5.05", grid).ok, false);

const migrated = migrateLensInventoryForAxisRename(
  renamed.items,
  "minusSph",
  "-5.25",
  "-5.50",
  "2026-01-03T00:00:00.000Z",
);
assert.equal(migrated[0]?.sph, "-5.50");

assert.match(readFileSync("components/admin/LensInventoryMatrix.tsx", "utf8"), /addSize/);
assert.match(readFileSync("components/admin/LensInventorySizeModal.tsx", "utf8"), /admin-lens-size-dialog--premium/);
assert.match(readFileSync("components/admin/LensSizeModalIllustration.tsx", "utf8"), /admin-lens-size-art-svg/);
assert.match(readFileSync("app/api/lens-inventory/grid/route.ts", "utf8"), /applyLensGridMutation/);
assert.doesNotMatch(
  readFileSync("components/admin/LensInventoryMatrix.tsx", "utf8"),
  /isDefaultMinusSph.*Pencil/s,
);

console.log(JSON.stringify({ lensInventoryGrid: "pass" }));

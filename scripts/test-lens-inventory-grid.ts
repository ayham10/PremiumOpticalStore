import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildLensOrderRows,
  LENS_MINUS_SPH,
  normalizeLensInventory,
} from "../lib/lens-inventory";
import {
  applyLensGridMutation,
  parseLensGridMutationBody,
} from "../lib/lens-inventory-grid-actions";
import {
  addCustomAxisValue,
  effectiveMinusSph,
  emptyLensInventoryCustomGrid,
  isCustomMinusSph,
  isDefaultMinusSph,
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

assert.equal(
  parseLensGridMutationBody({
    action: "edit",
    axis: "minusSph",
    from: "-5.00",
    to: "-5.25",
  }).ok,
  false,
);

const softDeleted = applyLensGridMutation(
  items,
  added,
  { action: "delete", axis: "minusSph", value: "-5.00" },
  "2026-01-02T00:00:00.000Z",
);
assert.ok(softDeleted.grid.deactivated?.minusSph?.includes("-5.00"));
assert.ok(!effectiveMinusSph(softDeleted.grid).includes("-5.00"));
assert.equal(softDeleted.items.length, 1);
assert.equal(buildLensOrderRows(softDeleted.items, softDeleted.grid).length, 0);

const emptyCustom = addCustomAxisValue(emptyLensInventoryCustomGrid(), "plusSph", "+5.00");
const hardDeleted = applyLensGridMutation(
  [],
  emptyCustom,
  { action: "delete", axis: "plusSph", value: "+5.00" },
  "2026-01-01T00:00:00.000Z",
);
assert.ok(!hardDeleted.grid.plusSph.includes("+5.00"));
assert.equal(hardDeleted.grid.deactivated?.plusSph?.length ?? 0, 0);

assert.equal(lensSphsFor("minus", added).length, LENS_MINUS_SPH.length + 1);

const deactivated = removeOrDeactivateCustomAxisValue(added, "minusSph", "-5.00", true);
assert.ok(deactivated.deactivated?.minusSph?.includes("-5.00"));
assert.ok(!effectiveMinusSph(deactivated).includes("-5.00"));

const restored = restoreDeactivatedCustomAxisValue(deactivated, "minusSph", "-5.00");
assert.ok(effectiveMinusSph(restored).includes("-5.00"));
assert.ok(!restored.deactivated?.minusSph?.includes("-5.00"));

assert.equal(validateCustomAxisValue("minusSph", "-5.05", grid).ok, false);

assert.throws(
  () =>
    applyLensGridMutation(
      items,
      added,
      { action: "delete", axis: "minusSph", value: "PLANO" },
      "2026-01-01T00:00:00.000Z",
    ),
  /Default|Custom/,
);

const matrixSrc = readFileSync("components/admin/LensInventoryMatrix.tsx", "utf8");
assert.match(matrixSrc, /addSize/);
assert.match(matrixSrc, /admin-lens-axis-btn--delete/);
assert.doesNotMatch(matrixSrc, /Pencil/);
assert.match(readFileSync("components/admin/LensInventorySizeModal.tsx", "utf8"), /admin-lens-size-dialog--confirm/);
assert.match(readFileSync("components/admin/LensSizeModalIllustration.tsx", "utf8"), /lens-size-modal-lenses\.png/);
assert.match(readFileSync("app/api/lens-inventory/grid/route.ts", "utf8"), /applyLensGridMutation/);

console.log(JSON.stringify({ lensInventoryGrid: "pass" }));

import { requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  jsonOk,
  pushActivity,
} from "@/lib/api/helpers";
import {
  LensInventoryConflictError,
  applyLensWrites,
  findLensWriteConflicts,
  parseLensInventoryWriteBody,
} from "@/lib/lens-inventory-edit";
import { lensCellKey } from "@/lib/lens-inventory";
import { normalizeLensInventoryCustomGrid } from "@/lib/lens-inventory-grid";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession("inventory");
    const { data } = await getStore();
    return jsonOk({
      items: data.lensInventory,
      customGrid: normalizeLensInventoryCustomGrid(data.lensInventoryCustom),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = await request.json();
    const { data: current } = await getStore();
    const grid = normalizeLensInventoryCustomGrid(current.lensInventoryCustom);
    const parsed = parseLensInventoryWriteBody(body, grid);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }
    const writes = parsed.items;

    try {
      const { data } = await updateStore((store) => {
        const conflicts = findLensWriteConflicts(store.lensInventory, writes);
        if (conflicts.length) {
          throw new LensInventoryConflictError(conflicts);
        }
        const updatedAt = new Date().toISOString();
        const lensInventory = applyLensWrites(
          store.lensInventory,
          writes,
          updatedAt,
        );
        const first = writes[0];
        pushActivity(store, {
          actor: session.email,
          action: "update",
          entity: "lens-inventory",
          entityId:
            writes.length === 1
              ? lensCellKey(first.type, first.sph, first.cyl)
              : `bulk:${writes.length}`,
          detail:
            writes.length === 1
              ? `Lens ${first.type} ${first.sph}/${first.cyl} ${first.currentStock}/${first.desiredStock}`
              : `Lens inventory bulk update (${writes.length} cells)`,
        });
        return { ...store, lensInventory };
      });

      const item =
        writes.length === 1
          ? data.lensInventory.find(
              (cell) =>
                cell.type === writes[0].type &&
                cell.sph === writes[0].sph &&
                cell.cyl === writes[0].cyl,
            ) ?? {
              ...writes[0],
              updatedAt: new Date().toISOString(),
            }
          : undefined;

      return jsonOk({
        item,
        items: data.lensInventory,
        saved: writes.length,
      });
    } catch (error) {
      if (error instanceof LensInventoryConflictError) {
        return jsonError(
          "Lens inventory was updated by someone else. Your unsaved edits were not overwritten.",
          409,
          {
            code: "LENS_INVENTORY_CONFLICT",
            conflicts: error.conflicts,
          },
        );
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

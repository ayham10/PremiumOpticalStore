import { requireSession } from "@/lib/auth";
import { updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  jsonOk,
  pushActivity,
} from "@/lib/api/helpers";
import {
  applyLensGridMutation,
  parseLensGridMutationBody,
} from "@/lib/lens-inventory-grid-actions";
import { normalizeLensInventory } from "@/lib/lens-inventory";
import { normalizeLensInventoryCustomGrid } from "@/lib/lens-inventory-grid";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession("inventory");
    const parsed = parseLensGridMutationBody(await request.json());
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    try {
      const { data } = await updateStore((store) => {
        const updatedAt = new Date().toISOString();
        const grid = normalizeLensInventoryCustomGrid(store.lensInventoryCustom);
        const result = applyLensGridMutation(
          store.lensInventory,
          grid,
          parsed.mutation,
          updatedAt,
        );
        const nextGrid = result.grid;
        const nextItems = normalizeLensInventory(result.items, nextGrid);
        pushActivity(store, {
          actor: session.email,
          action: "update",
          entity: "lens-inventory-grid",
          entityId: `${parsed.mutation.action}:${parsed.mutation.axis}`,
          detail: `Lens grid ${parsed.mutation.action} ${parsed.mutation.axis}`,
        });
        return {
          ...store,
          lensInventory: nextItems,
          lensInventoryCustom: nextGrid,
        };
      });

      return jsonOk({
        items: data.lensInventory,
        customGrid: normalizeLensInventoryCustomGrid(data.lensInventoryCustom),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Grid update failed";
      return jsonError(message, 400);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

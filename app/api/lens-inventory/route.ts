import { requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  jsonOk,
  pushActivity,
} from "@/lib/api/helpers";
import {
  isAllowedCyl,
  isAllowedSph,
  isLensInventorySign,
  parseLensQty,
  upsertLensInventoryCell,
} from "@/lib/lens-inventory";
import type { LensInventoryCell } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession("inventory");
    const { data } = await getStore();
    return jsonOk({ items: data.lensInventory });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession("inventory");
    const body = (await request.json()) as Partial<LensInventoryCell>;
    if (!isLensInventorySign(body.type)) {
      return jsonError("Invalid lens type", 400);
    }
    const sph = typeof body.sph === "string" ? body.sph.trim() : "";
    const cyl = typeof body.cyl === "string" ? body.cyl.trim() : "";
    if (!isAllowedSph(body.type, sph) || !isAllowedCyl(cyl)) {
      return jsonError("Invalid SPH or CYL", 400);
    }
    const currentStock = parseLensQty(body.currentStock);
    const desiredStock = parseLensQty(body.desiredStock);
    if (currentStock == null || desiredStock == null) {
      return jsonError("Stock values must be whole numbers of 0 or more", 400);
    }

    const nextCell: LensInventoryCell = {
      type: body.type,
      sph,
      cyl,
      currentStock,
      desiredStock,
      updatedAt: new Date().toISOString(),
    };

    const { data } = await updateStore((store) => {
      const lensInventory = upsertLensInventoryCell(
        store.lensInventory,
        nextCell,
      );
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "lens-inventory",
        entityId: `${nextCell.type}:${nextCell.sph}:${nextCell.cyl}`,
        detail: `Lens ${nextCell.type} ${nextCell.sph}/${nextCell.cyl} ${nextCell.currentStock}/${nextCell.desiredStock}`,
      });
      return { ...store, lensInventory };
    });

    return jsonOk({
      item: nextCell,
      items: data.lensInventory,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

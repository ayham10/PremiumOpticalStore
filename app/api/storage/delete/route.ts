import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteMedia, isStorageUrl, supabaseServerConfig } from "@/lib/storage";
import { updateStore } from "@/lib/db/store";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("media");
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) return jsonError("url is required", 400);

    if (!isStorageUrl(url)) {
      // External / non-supabase URLs: only detach from media library
      await updateStore((store) => {
        const before = store.media.length;
        store.media = store.media.filter((m) => m.url !== url);
        if (store.media.length === before) {
          // still log attempt
        }
        pushActivity(store, {
          actor: session.email,
          action: "delete",
          entity: "storage",
          detail: `Detached non-storage URL: ${url}`,
        });
        return store;
      });
      return NextResponse.json({
        ok: true,
        deleted: false,
        message: "URL is not a Supabase storage object; removed library entries only",
      });
    }

    const config = supabaseServerConfig();
    if (!config) {
      return jsonError(
        "Supabase storage is not configured. Cannot delete remote media objects.",
        503
      );
    }

    await deleteMedia(url);

    await updateStore((store) => {
      store.media = store.media.filter((m) => m.url !== url);
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "storage",
        detail: url,
      });
      return store;
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

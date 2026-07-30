import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import { deleteMedia } from "@/lib/storage";
import {
  handleRouteError,
  jsonError,
  pushActivity,
} from "@/lib/api/helpers";
import type { MediaItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const FOLDERS = new Set<MediaItem["folder"]>([
  "gallery",
  "hero",
  "products",
  "promotions",
  "general",
]);

export async function GET(request: Request) {
  try {
    await requireSession("media");
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder");
    const { data } = await getStore();

    let media = [...data.media];
    if (folder && FOLDERS.has(folder as MediaItem["folder"])) {
      media = media.filter((m) => m.folder === folder);
    }

    media.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ media });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("media");
    const body = (await request.json()) as Partial<MediaItem>;

    const url = body.url?.trim();
    if (!url) return jsonError("Media url is required", 400);

    const folder = (body.folder || "general") as MediaItem["folder"];
    if (!FOLDERS.has(folder)) return jsonError("Invalid folder", 400);

    const type: MediaItem["type"] =
      body.type === "video" || url.match(/\.(mp4|webm)(\?|$)/i)
        ? "video"
        : "image";

    const item: MediaItem = {
      id: newId("media"),
      url,
      type,
      alt: body.alt?.trim() || undefined,
      folder,
      createdAt: new Date().toISOString(),
    };

    await updateStore((store) => {
      store.media.unshift(item);
      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "media",
        entityId: item.id,
        detail: item.url,
      });
      return store;
    });

    return NextResponse.json({ media: item }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("media");
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let removeStorage = searchParams.get("removeStorage") === "1";

    if (!id) {
      try {
        const body = (await request.json()) as {
          id?: string;
          removeStorage?: boolean;
        };
        id = body.id || null;
        if (body.removeStorage) removeStorage = true;
      } catch {
        // no body
      }
    }

    if (!id) return jsonError("Media id is required", 400);

    let removed: MediaItem | null = null;

    await updateStore(async (store) => {
      const index = store.media.findIndex((m) => m.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      removed = store.media[index];
      store.media.splice(index, 1);

      if (removeStorage && removed.url) {
        try {
          await deleteMedia(removed.url);
        } catch (error) {
          console.error("Failed to delete storage object", error);
        }
      }

      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "media",
        entityId: id!,
        detail: removed.url,
      });
      return store;
    });

    return NextResponse.json({ ok: true, media: removed });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Media item not found", 404);
    }
    return handleRouteError(error);
  }
}

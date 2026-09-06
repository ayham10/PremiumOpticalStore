import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import {
  generateFilename,
  inferContentType,
  isAllowedUploadMime,
  supabaseServerConfig,
  uploadMedia,
} from "@/lib/storage";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import { updateStore } from "@/lib/db/store";
import type { MediaItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await requireSession("media");

    const config = supabaseServerConfig();
    if (!config) {
      return jsonError(
        "Media upload requires Supabase storage. Configure SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), then retry. For filesystem-only mode, add an external image URL via POST /api/media instead.",
        503
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const slugValue = form.get("slug");
    const folderValue = form.get("folder");
    const altValue = form.get("alt");
    const register = form.get("register") !== "0";

    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }

    if (file.size <= 0) return jsonError("Empty file", 400);
    if (file.size > MAX_BYTES) {
      return jsonError("File exceeds 12MB limit", 413);
    }

    const contentType = inferContentType(file.name, file.type);
    if (!isAllowedUploadMime(contentType)) {
      return jsonError("Only JPG, PNG, WebP images and MP4/WebM videos are supported", 400);
    }

    const slug =
      (typeof slugValue === "string" && slugValue.trim()) ||
      file.name.replace(/\.[^.]+$/, "") ||
      "media";

    const filename = generateFilename(slug, contentType);
    const folder = (
      typeof folderValue === "string" && folderValue.trim()
        ? folderValue.trim()
        : "general"
    ) as MediaItem["folder"];

    const buffer = new Uint8Array(await file.arrayBuffer());
    const path = `${folder}/${filename}`;
    const url = await uploadMedia(buffer, path, contentType);

    let media: MediaItem | null = null;

    if (register) {
      media = {
        id: newId("media"),
        url,
        type: contentType.startsWith("video/") ? "video" : "image",
        alt:
          (typeof altValue === "string" && altValue.trim()) ||
          slug.replace(/-/g, " "),
        folder: ["gallery", "hero", "products", "promotions", "general"].includes(
          folder
        )
          ? folder
          : "general",
        createdAt: new Date().toISOString(),
      };

      await updateStore((store) => {
        store.media.unshift(media!);
        pushActivity(store, {
          actor: session.email,
          action: "upload",
          entity: "media",
          entityId: media!.id,
          detail: url,
        });
        return store;
      });
    } else {
      await updateStore((store) => {
        pushActivity(store, {
          actor: session.email,
          action: "upload",
          entity: "storage",
          detail: url,
        });
        return store;
      });
    }

    return NextResponse.json({ url, media }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

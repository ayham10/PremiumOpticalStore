"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import MediaCategoryDefaultImages from "@/components/admin/MediaCategoryDefaultImages";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import {
  isCategoryDefaultImageKey,
  mergeCategoryDefaultImages,
} from "@/lib/product-images";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import type {
  AdminSession,
  CategoryDefaultImageKey,
  CategoryDefaultImages,
  MediaItem,
} from "@/lib/types";

const FOLDERS: MediaItem["folder"][] = [
  "gallery",
  "hero",
  "products",
  "promotions",
  "general",
];

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function fileMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return file.type;
}

function unwrapList<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [folder, setFolder] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [newFolder, setNewFolder] = useState<MediaItem["folder"]>("gallery");
  const [type, setType] = useState<"image" | "video">("image");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [defaults, setDefaults] = useState<CategoryDefaultImages>({});
  const [defaultFor, setDefaultFor] = useState<"" | CategoryDefaultImageKey>("");
  const uploadInputEl = useRef<HTMLInputElement | null>(null);
  const canAssignDefaults = hasPermission(role, "settings");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, me, settingsPayload] = await Promise.all([
        apiFetch<unknown>("/api/media"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null
        ),
        apiFetch<{ settings?: { categoryDefaultImages?: CategoryDefaultImages } }>(
          "/api/settings",
        ).catch(() => null),
      ]);
      setItems(unwrapList<MediaItem>(data, ["media", "items", "data"]));
      setDefaults(
        mergeCategoryDefaultImages(
          settingsPayload?.settings?.categoryDefaultImages,
        ),
      );
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetAddForm() {
    setUrl("");
    setAlt("");
    setDefaultFor("");
    setType("image");
  }

  async function saveCategoryDefault(
    key: CategoryDefaultImageKey,
    imageUrl: string,
  ) {
    await apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        settings: {
          categoryDefaultImages: {
            [key]: imageUrl,
          },
        },
      }),
    });
    setDefaults((prev) =>
      mergeCategoryDefaultImages({
        ...prev,
        [key]: imageUrl,
      }),
    );
    invalidatePublicCache("settings:");
  }

  async function assignDefaultIfNeeded(imageUrl: string) {
    if (!defaultFor || type === "video") return;
    if (!canAssignDefaults) {
      throw new Error("You do not have permission to set category default images");
    }
    await saveCategoryDefault(defaultFor, imageUrl);
  }

  const filtered = useMemo(() => {
    if (folder === "all") return items;
    return items.filter((m) => m.folder === folder);
  }, [items, folder]);

  async function addByUrl(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const created = await apiFetch<MediaItem | { media: MediaItem }>(
        "/api/media",
        {
          method: "POST",
          body: JSON.stringify({
            url,
            alt: alt || undefined,
            folder: newFolder,
            type,
          }),
        }
      );
      const row =
        created && typeof created === "object" && "media" in created
          ? created.media
          : (created as MediaItem);
      setItems((prev) => [row, ...prev]);
      await assignDefaultIfNeeded(row.url);
      setModalOpen(false);
      resetAddForm();
      setMessage(
        defaultFor
          ? `Media added and set as ${defaultFor} default`
          : "Media added",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    setMessage("");

    const allowed =
      type === "video" ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    const mime = fileMime(file);
    if (!allowed.has(mime)) {
      setMessage(
        type === "video"
          ? "Use MP4 or WebM video only"
          : "Use JPG, PNG, or WebP only",
      );
      setUploading(false);
      if (uploadInputEl.current) uploadInputEl.current.value = "";
      return;
    }
    if (file.size <= 0) {
      setMessage("File is empty");
      setUploading(false);
      if (uploadInputEl.current) uploadInputEl.current.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage("File exceeds 12 MB limit");
      setUploading(false);
      if (uploadInputEl.current) uploadInputEl.current.value = "";
      return;
    }

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", newFolder);
      body.append("alt", alt.trim() || file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        url?: string;
        media?: MediaItem;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      let addedUrl = "";
      if (data.media) {
        setItems((prev) => [data.media!, ...prev]);
        addedUrl = data.media.url;
      } else if (data.url) {
        const created = await apiFetch<MediaItem | { media: MediaItem }>(
          "/api/media",
          {
            method: "POST",
            body: JSON.stringify({
              url: data.url,
              folder: newFolder,
              type: mime.startsWith("video/") ? "video" : "image",
              alt: alt.trim() || file.name.replace(/\.[^.]+$/, ""),
            }),
          }
        );
        const row =
          created && typeof created === "object" && "media" in created
            ? created.media
            : (created as MediaItem);
        setItems((prev) => [row, ...prev]);
        addedUrl = row.url;
      } else {
        throw new Error("Upload succeeded but no media record was returned");
      }
      await assignDefaultIfNeeded(addedUrl);
      setMessage(
        defaultFor
          ? `Upload complete and set as ${defaultFor} default`
          : "Upload complete",
      );
      setModalOpen(false);
      resetAddForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (uploadInputEl.current) uploadInputEl.current.value = "";
    }
  }

  async function onDelete(m: MediaItem) {
    if (!hasPermission(role, "delete")) {
      setMessage("You do not have permission to delete");
      return;
    }
    if (!confirm("Delete this media item?")) return;
    try {
      await apiFetch(`/api/media?id=${encodeURIComponent(m.id)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      if (preview?.id === m.id) setPreview(null);
      setMessage("Media deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="admin-media-page">
      <AdminPageHeader
        icon={ImageIcon}
        kicker="Library"
        title="Media"
        description="Uploaded images for products, promotions, and the website."
        actions={
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              resetAddForm();
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add media
          </button>
        }
      />

      <MediaCategoryDefaultImages
        defaults={defaults}
        canEdit={canAssignDefaults}
        onChange={(key) => {
          setType("image");
          setDefaultFor(key);
          setModalOpen(true);
        }}
        onClear={async (key) => {
          setMessage("");
          try {
            await saveCategoryDefault(key, "");
            setMessage(`${key} default cleared`);
          } catch (err) {
            setMessage(
              err instanceof Error ? err.message : "Could not clear default",
            );
          }
        }}
      />

      <div className="admin-card admin-media-folder-bar">
        <select
          className="select admin-media-folder-select"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="all">All folders</option>
          {FOLDERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[var(--slate)]">Loading media…</p>
      ) : (
        <div className="admin-media-library-grid">
          {filtered.map((m) => (
            <article key={m.id} className="admin-card admin-media-library-card">
              <button
                type="button"
                className="admin-media-library-thumb"
                onClick={() => setPreview(m)}
              >
                {m.type === "video" ? (
                  <video src={m.url} muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt || "Media"} />
                )}
              </button>
              <div className="admin-media-library-meta">
                <div className="admin-media-library-copy">
                  <p className="admin-media-library-title">
                    {m.alt || m.url}
                  </p>
                  <p className="admin-media-library-sub">
                    {m.folder}
                    {m.createdAt
                      ? ` · ${new Date(m.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </p>
                </div>
                {hasPermission(role, "delete") ? (
                  <button
                    type="button"
                    className="admin-media-library-delete"
                    onClick={() => void onDelete(m)}
                    aria-label="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!filtered.length ? (
            <p className="col-span-full text-[var(--slate)]">No media in this folder</p>
          ) : null}
        </div>
      )}

      <AdminModal
        open={modalOpen}
        title="Add media"
        onClose={() => {
          setModalOpen(false);
          resetAddForm();
        }}
      >
        <form onSubmit={addByUrl} className="space-y-4">
          <div>
            <label className="label" htmlFor="m-url">
              Media URL
            </label>
            <input
              id="m-url"
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="m-alt">
              Alt text
            </label>
            <input
              id="m-alt"
              className="input"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="m-folder">
                Folder
              </label>
              <select
                id="m-folder"
                className="select"
                value={newFolder}
                onChange={(e) =>
                  setNewFolder(e.target.value as MediaItem["folder"])
                }
              >
                {FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="m-type">
                Type
              </label>
              <select
                id="m-type"
                className="select"
                value={type}
                onChange={(e) => {
                  const next = e.target.value as "image" | "video";
                  setType(next);
                  if (next === "video") setDefaultFor("");
                }}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>
          {type === "image" ? (
            <div>
              <label className="label" htmlFor="m-default-for">
                Default image for
              </label>
              <select
                id="m-default-for"
                className="select"
                value={defaultFor}
                disabled={!canAssignDefaults}
                onChange={(e) => {
                  const value = e.target.value;
                  setDefaultFor(
                    isCategoryDefaultImageKey(value) ? value : "",
                  );
                }}
              >
                <option value="">None</option>
                <option value="Frames">Frames</option>
                <option value="Sunglasses">Sunglasses</option>
                <option value="Contact Lenses">Contact Lenses</option>
              </select>
              <p className="mt-1.5 text-xs text-[var(--slate)]">
                Optional. Does not change Folder. Used only when a product in
                that category has no image of its own.
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-4 text-center">
            <label className="btn btn-ghost cursor-pointer">
              <Upload size={16} />
              {uploading ? "Uploading…" : "Upload file"}
              <input
                ref={uploadInputEl}
                type="file"
                accept={
                  type === "video"
                    ? "video/mp4,video/webm"
                    : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                }
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file);
                }}
              />
            </label>
            <p className="mt-2 text-xs text-[var(--slate)]">
              Uses /api/storage/upload when available; otherwise paste a URL.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setModalOpen(false);
                resetAddForm();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? "Saving…" : "Add by URL"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={!!preview}
        title={preview?.alt || "Preview"}
        onClose={() => setPreview(null)}
        wide
      >
        {preview ? (
          <div className="space-y-3">
            {preview.type === "video" ? (
              <video src={preview.url} controls className="w-full rounded-xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.alt || "Preview"}
                className="w-full rounded-xl"
              />
            )}
            <p className="break-all text-sm text-[var(--slate)]">{preview.url}</p>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

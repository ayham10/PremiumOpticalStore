"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import type { AdminSession, MediaItem } from "@/lib/types";

const FOLDERS: MediaItem["folder"][] = [
  "gallery",
  "hero",
  "products",
  "promotions",
  "general",
];

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, me] = await Promise.all([
        apiFetch<unknown>("/api/media"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null
        ),
      ]);
      setItems(unwrapList<MediaItem>(data, ["media", "items", "data"]));
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
      setModalOpen(false);
      setUrl("");
      setAlt("");
      setMessage("Media added");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", newFolder);
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        throw new Error("Upload endpoint unavailable — paste a URL instead");
      }
      const data = (await res.json()) as {
        url?: string;
        media?: MediaItem;
      };
      if (data.media) {
        setItems((prev) => [data.media!, ...prev]);
      } else if (data.url) {
        const created = await apiFetch<MediaItem | { media: MediaItem }>(
          "/api/media",
          {
            method: "POST",
            body: JSON.stringify({
              url: data.url,
              folder: newFolder,
              type: file.type.startsWith("video") ? "video" : "image",
              alt: file.name,
            }),
          }
        );
        const row =
          created && typeof created === "object" && "media" in created
            ? created.media
            : (created as MediaItem);
        setItems((prev) => [row, ...prev]);
      }
      setMessage("Upload complete");
      setModalOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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
    <div className="space-y-5">
      <AdminPageHeader
        icon={ImageIcon}
        kicker="Library"
        title="Media"
        description="Uploaded images for products, promotions, and the website."
        actions={
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} /> Add media
          </button>
        }
      />

      <div className="admin-card flex flex-wrap gap-3 p-4">
        <select
          className="select max-w-[220px]"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => (
            <article key={m.id} className="admin-card overflow-hidden">
              <button
                type="button"
                className="block w-full aspect-[4/3] bg-[var(--mist)]"
                onClick={() => setPreview(m)}
              >
                {m.type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.alt || "Media"}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">
                    {m.alt || m.url}
                  </p>
                  <p className="text-xs text-[var(--slate)]">{m.folder}</p>
                </div>
                {hasPermission(role, "delete") ? (
                  <button
                    type="button"
                    className="text-[var(--danger)]"
                    onClick={() => void onDelete(m)}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
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
        onClose={() => setModalOpen(false)}
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
                onChange={(e) => setType(e.target.value as "image" | "video")}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-4 text-center">
            <label className="btn btn-ghost cursor-pointer">
              <Upload size={16} />
              {uploading ? "Uploading…" : "Upload file"}
              <input
                type="file"
                accept="image/*,video/*"
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
              onClick={() => setModalOpen(false)}
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

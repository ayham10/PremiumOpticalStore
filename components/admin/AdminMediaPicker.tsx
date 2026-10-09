"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import type { CustomPageMediaRef, MediaItem } from "@/lib/types";

type Accept = "image" | "video" | "any";

function unwrapMedia(data: unknown): MediaItem[] {
  if (Array.isArray(data)) return data as MediaItem[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.media)) return obj.media as MediaItem[];
  }
  return [];
}

export default function AdminMediaPicker({
  open,
  title,
  accept = "any",
  emptyLabel,
  stacked,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  accept?: Accept;
  emptyLabel: string;
  stacked?: boolean;
  onClose: () => void;
  onPick: (media: CustomPageMediaRef) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<unknown>("/api/media");
      setItems(unwrapMedia(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (accept === "any") return true;
      return item.type === accept;
    });
  }, [items, accept]);

  return (
    <AdminModal
      open={open}
      title={title}
      onClose={onClose}
      wide
      stacked={stacked}
      icon={<ImageIcon size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="admin-muted">…</p>
      ) : visible.length === 0 ? (
        <p className="admin-muted">{emptyLabel}</p>
      ) : (
        <div className="csp-media-grid">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className="csp-media-tile"
              onClick={() => {
                onPick({
                  kind: item.type === "video" ? "video" : "image",
                  url: item.url,
                  mediaId: item.id,
                });
                onClose();
              }}
            >
              {item.type === "video" ? (
                <video src={item.url} muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.alt || ""} />
              )}
              <span>{item.type === "video" ? "video" : "image"}</span>
            </button>
          ))}
        </div>
      )}
    </AdminModal>
  );
}

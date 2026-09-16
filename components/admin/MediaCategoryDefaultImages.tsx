"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { CATEGORY_DEFAULT_IMAGE_KEYS } from "@/lib/product-images";
import type { CategoryDefaultImageKey, CategoryDefaultImages } from "@/lib/types";

type Props = {
  defaults: CategoryDefaultImages;
  canEdit: boolean;
  onChange: (key: CategoryDefaultImageKey) => void;
  onClear: (key: CategoryDefaultImageKey) => void;
};

export default function MediaCategoryDefaultImages({
  defaults,
  canEdit,
  onChange,
  onClear,
}: Props) {
  return (
    <section className="admin-card space-y-4 p-5">
      <div>
        <h2 className="admin-section-title">Default Product Images</h2>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Used only when a product in that category has no photo of its own.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {CATEGORY_DEFAULT_IMAGE_KEYS.map((key) => {
          const url = defaults[key] || "";
          return (
            <article
              key={key}
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--admin-elevated)]"
            >
              <div className="relative aspect-[4/3] bg-[var(--mist)]">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`${key} default`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center px-3 text-center text-xs text-[var(--slate)]">
                    No default image
                  </div>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">{key}</p>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost !min-h-9 !px-3 !text-xs"
                      onClick={() => onChange(key)}
                    >
                      <ImagePlus size={14} />
                      Change
                    </button>
                    {url ? (
                      <button
                        type="button"
                        className="btn btn-ghost !min-h-9 !px-3 !text-xs text-[var(--danger)]"
                        onClick={() => onClear(key)}
                      >
                        <Trash2 size={14} />
                        Clear
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

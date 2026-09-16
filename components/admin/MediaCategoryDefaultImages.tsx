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
    <section className="admin-card admin-media-defaults">
      <div>
        <h2 className="admin-section-title">Default Product Images</h2>
        <p className="admin-media-defaults-hint">
          Used only when a product in that category has no photo of its own.
        </p>
      </div>
      <div className="admin-media-defaults-grid">
        {CATEGORY_DEFAULT_IMAGE_KEYS.map((key) => {
          const url = defaults[key] || "";
          return (
            <article key={key} className="admin-media-default-card">
              <div className="admin-media-default-preview">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`${key} default`} />
                ) : null}
              </div>
              <div className="admin-media-default-meta">
                <p className="admin-media-default-name">{key}</p>
                {!url ? (
                  <p className="admin-media-default-empty">No default image</p>
                ) : null}
                {canEdit ? (
                  <div className="admin-media-default-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onChange(key)}
                    >
                      <ImagePlus size={12} />
                      Change
                    </button>
                    {url ? (
                      <button
                        type="button"
                        className="btn btn-ghost admin-media-default-clear"
                        onClick={() => onClear(key)}
                      >
                        <Trash2 size={12} />
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

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function ActionButtons({
  canDelete,
  onEdit,
  onDelete,
}: {
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="admin-product-card-actions">
      <button
        type="button"
        onClick={onEdit}
        aria-label="تعديل"
        className="admin-product-icon-btn"
      >
        <Pencil size={13} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="حذف"
        className="admin-product-icon-btn is-danger"
      >
        <Trash2 size={13} strokeWidth={1.6} />
      </button>
    </div>
  );
}

export default function AdminProductCard({
  product,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  const thumb = product.images?.[0];
  const isActive = product.status === "active";

  return (
    <article className="admin-product-card">
      <div className="admin-product-card-media">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="admin-product-card-img" />
        ) : (
          <div className="admin-product-card-placeholder">—</div>
        )}
        {isActive ? (
          <span className="admin-product-card-badge">نشط</span>
        ) : null}
      </div>

      <div className="admin-product-card-body">
        <h2 className="admin-product-card-name">{product.name}</h2>
        <div className="admin-product-card-footer">
          <div className="admin-product-card-meta">
            <p className="admin-product-card-price">
              {formatPrice(product.sellingPrice)}
            </p>
            <p className="admin-product-card-stock">
              المخزون: {product.stockQuantity}
            </p>
          </div>
          <ActionButtons
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

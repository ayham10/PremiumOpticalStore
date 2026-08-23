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
        <div className="admin-product-card-heading">
          <h2 className="admin-product-card-name">{product.name}</h2>
          {isActive ? (
            <span className="admin-product-card-badge-inline">نشط</span>
          ) : null}
        </div>

        <div className="admin-product-card-stats">
          <div className="admin-product-card-stat admin-product-card-stat--stock">
            <span className="admin-product-card-stat-label">المخزون</span>
            <span className="admin-product-card-stat-value">
              {product.stockQuantity}
            </span>
          </div>
          <div className="admin-product-card-stat-divider" aria-hidden="true" />
          <div className="admin-product-card-stat admin-product-card-stat--price">
            <span className="admin-product-card-stat-label">السعر</span>
            <span className="admin-product-card-stat-value admin-product-card-price">
              {formatPrice(product.sellingPrice)}
            </span>
          </div>
        </div>

        <div className="admin-product-card-footer">
          <div className="admin-product-card-meta">
            <p className="admin-product-card-price">
              {formatPrice(product.sellingPrice)}
            </p>
            <p className="admin-product-card-stock">
              المخزون: {product.stockQuantity}
            </p>
          </div>
          <div className="admin-product-card-actions">
            <button
              type="button"
              onClick={onEdit}
              aria-label="تعديل"
              className="admin-product-icon-btn admin-product-action is-edit"
            >
              <Pencil size={13} strokeWidth={1.6} />
              <span className="admin-product-action-label">تعديل</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete}
              aria-label="حذف"
              className="admin-product-icon-btn is-danger admin-product-action is-delete"
            >
              <Trash2 size={13} strokeWidth={1.6} />
              <span className="admin-product-action-label">حذف</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

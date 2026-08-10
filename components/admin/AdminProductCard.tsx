"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const PAGE_BG = "#0E1116";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const GOLD = "#D4AF6A";
const MUTED = "#8A929C";

type Props = {
  product: Product;
  canDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function AdminProductCard({
  product,
  canDelete,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const thumb = product.images?.[0];
  const isActive = product.status === "active";

  return (
    <article
      className="flex h-full flex-col overflow-hidden"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
      }}
    >
      {/* Image — main visual (~55–60% of card) */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{
          background: PAGE_BG,
          aspectRatio: "5 / 4",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="grid h-full place-items-center text-[0.75rem]"
            style={{ color: MUTED }}
          >
            —
          </div>
        )}

        <span
          className="absolute end-2.5 top-2.5 rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
          style={
            isActive
              ? {
                  background: "rgba(94,196,154,0.18)",
                  color: "#5EC49A",
                  border: "1px solid rgba(94,196,154,0.35)",
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  color: MUTED,
                  border: `1px solid ${BORDER}`,
                }
          }
        >
          {isActive ? "نشط" : "غير نشط"}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-3 pb-0 pt-3">
        <h2
          className="m-0 line-clamp-2 text-[0.95rem] font-semibold leading-snug"
          style={{ color: "#FFFFFF", minHeight: "2.4em" }}
        >
          {product.name}
        </h2>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <p
            className="m-0 text-[1rem] font-bold tabular-nums"
            style={{ color: GOLD }}
          >
            {formatPrice(product.sellingPrice)}
          </p>
          <p className="m-0 text-[0.8rem] font-semibold" style={{ color: MUTED }}>
            المخزون:{" "}
            <span style={{ color: "#FFFFFF" }}>{product.stockQuantity}</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div
        className="mt-3 grid grid-cols-3"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[0.78rem] font-semibold"
          style={{
            color: GOLD,
            background: "transparent",
            border: "none",
            borderInlineEnd: `1px solid ${BORDER}`,
          }}
        >
          <Pencil size={14} strokeWidth={1.55} />
          تعديل
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[0.78rem] font-semibold"
          style={{
            color: MUTED,
            background: "transparent",
            border: "none",
            borderInlineEnd: `1px solid ${BORDER}`,
          }}
        >
          <Copy size={14} strokeWidth={1.55} />
          نسخ
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[0.78rem] font-semibold disabled:opacity-40"
          style={{
            color: "#F07178",
            background: "transparent",
            border: "none",
          }}
        >
          <Trash2 size={14} strokeWidth={1.55} />
          حذف
        </button>
      </div>
    </article>
  );
}

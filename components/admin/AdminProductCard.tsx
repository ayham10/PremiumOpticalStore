"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const PAGE_BG = "#0B0E14";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const GOLD = "#D4AF37";
const MUTED = "#8A929C";
const DANGER = "#F07178";

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
  size = 36,
}: {
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  size?: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label="تعديل"
        className="grid place-items-center rounded-[10px] transition hover:brightness-110"
        style={{
          width: size,
          height: size,
          color: GOLD,
          background: "transparent",
          border: `1px solid rgba(212,175,55,0.65)`,
        }}
      >
        <Pencil size={15} strokeWidth={1.55} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="حذف"
        className="grid place-items-center rounded-[10px] transition hover:brightness-110 disabled:opacity-40"
        style={{
          width: size,
          height: size,
          color: DANGER,
          background: "transparent",
          border: `1px solid rgba(240,113,120,0.55)`,
        }}
      >
        <Trash2 size={15} strokeWidth={1.55} />
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

  const badge = isActive ? (
    <span
      className="rounded-full px-2 py-0.5 text-[0.62rem] font-bold"
      style={{
        background: "rgba(46, 204, 113, 0.92)",
        color: "#0B1A12",
        lineHeight: 1.35,
      }}
    >
      نشط
    </span>
  ) : null;

  return (
    <article
      className="admin-product-card overflow-hidden"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        height: "100%",
      }}
    >
      {/* MOBILE — image RIGHT (RTL start), details LEFT */}
      <div className="flex items-stretch gap-3.5 p-3 md:hidden">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 108,
            height: 108,
            borderRadius: 12,
            background: PAGE_BG,
            border: `1px solid ${BORDER}`,
          }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="grid h-full place-items-center text-[0.7rem]"
              style={{ color: MUTED }}
            >
              —
            </div>
          )}
          {badge ? (
            <div className="absolute end-1.5 top-1.5">{badge}</div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <h2
              className="m-0 line-clamp-2 text-[0.9rem] font-semibold leading-snug"
              style={{ color: "#FFFFFF" }}
            >
              {product.name}
            </h2>
            <p
              className="mb-0 mt-1.5 text-[0.95rem] font-bold tabular-nums"
              style={{ color: GOLD }}
            >
              {formatPrice(product.sellingPrice)}
            </p>
            <p
              className="mb-0 mt-1.5 text-[0.78rem] font-semibold"
              style={{ color: "#FFFFFF" }}
            >
              المخزون: {product.stockQuantity}
            </p>
          </div>
          <div className="mt-2.5 self-start">
            <ActionButtons
              size={34}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP — image top, equal card body */}
      <div className="hidden h-full flex-col md:flex">
        <div
          className="relative w-full shrink-0 overflow-hidden"
          style={{
            background: PAGE_BG,
            aspectRatio: "4 / 3",
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
          {badge ? (
            <div className="absolute end-2.5 top-2.5">{badge}</div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
          <h2
            className="m-0 line-clamp-2 text-[0.9rem] font-semibold leading-snug"
            style={{ color: "#FFFFFF", minHeight: "2.4em" }}
          >
            {product.name}
          </h2>
          <p
            className="mb-0 mt-2 text-[1rem] font-bold tabular-nums"
            style={{ color: GOLD }}
          >
            {formatPrice(product.sellingPrice)}
          </p>
          <p
            className="mb-0 mt-1.5 text-[0.8rem] font-semibold"
            style={{ color: "#FFFFFF" }}
          >
            المخزون: {product.stockQuantity}
          </p>
          <div className="mt-auto pt-3.5">
            <ActionButtons
              size={38}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

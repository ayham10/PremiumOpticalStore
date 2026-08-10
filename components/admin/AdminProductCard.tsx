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
      className="shrink-0 rounded-[6px] px-1.5 py-0.5 text-[0.6rem] font-bold"
      style={{
        background: "#0F3D2E",
        color: "#FFFFFF",
        lineHeight: 1.3,
      }}
    >
      نشط
    </span>
  ) : null;

  return (
    <article
      className="admin-product-card overflow-hidden md:h-full"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      {/* MOBILE — compact: image RIGHT, details LEFT */}
      <div className="flex items-start gap-3 p-2.5 md:hidden">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 100,
            height: 100,
            borderRadius: 11,
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
        </div>

        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ minHeight: 100 }}
        >
          <div className="flex items-start gap-2">
            <h2
              className="m-0 min-w-0 flex-1 truncate text-[0.88rem] font-semibold leading-snug"
              style={{ color: "#FFFFFF" }}
            >
              {product.name}
            </h2>
            {badge}
          </div>
          <p
            className="mb-0 mt-1.5 text-[0.92rem] font-bold tabular-nums leading-none"
            style={{ color: GOLD }}
          >
            {formatPrice(product.sellingPrice)}
          </p>
          <p
            className="mb-0 mt-1.5 text-[0.74rem] font-medium leading-none"
            style={{ color: MUTED }}
          >
            المخزون: {product.stockQuantity}
          </p>
          <div className="mt-auto self-end pt-2">
            <ActionButtons
              size={32}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP — unchanged structure */}
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
          {isActive ? (
            <div className="absolute end-2.5 top-2.5">
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
            </div>
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

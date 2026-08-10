"use client";

import { Pencil, Trash2 } from "lucide-react";
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
  onDelete: () => void;
};

function ActionButtons({
  canDelete,
  onEdit,
  onDelete,
  compact,
}: {
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const size = compact ? 40 : 42;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label="تعديل"
        className="grid place-items-center rounded-[11px] transition hover:brightness-110"
        style={{
          width: size,
          height: size,
          color: GOLD,
          background: "rgba(212,175,106,0.10)",
          border: "1px solid rgba(212,175,106,0.45)",
        }}
      >
        <Pencil size={compact ? 16 : 17} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="حذف"
        className="grid place-items-center rounded-[11px] transition hover:brightness-110 disabled:opacity-40"
        style={{
          width: size,
          height: size,
          color: "#F07178",
          background: "rgba(240,113,120,0.10)",
          border: "1px solid rgba(240,113,120,0.4)",
        }}
      >
        <Trash2 size={compact ? 16 : 17} strokeWidth={1.6} />
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

  const badge = (
    <span
      className="rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold"
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
  );

  return (
    <article
      className="overflow-hidden"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      {/* MOBILE — horizontal compact row */}
      <div className="flex items-stretch gap-3 p-2.5 md:hidden">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 110,
            height: 110,
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

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2
                className="m-0 line-clamp-2 text-[0.88rem] font-semibold leading-snug"
                style={{ color: "#FFFFFF" }}
              >
                {product.name}
              </h2>
              {badge}
            </div>
            <p
              className="mb-0 mt-1.5 text-[0.92rem] font-bold tabular-nums"
              style={{ color: GOLD }}
            >
              {formatPrice(product.sellingPrice)}
            </p>
            <p className="mb-0 mt-1 text-[0.75rem] font-semibold" style={{ color: MUTED }}>
              المخزون:{" "}
              <span style={{ color: "#FFFFFF" }}>{product.stockQuantity}</span>
            </p>
          </div>
          <div className="mt-2">
            <ActionButtons
              compact
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP — compact vertical card */}
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
          <div className="absolute end-2 top-2">{badge}</div>
        </div>

        <div className="flex flex-1 flex-col px-2.5 pb-0 pt-2.5">
          <h2
            className="m-0 line-clamp-2 text-[0.84rem] font-semibold leading-snug"
            style={{ color: "#FFFFFF", minHeight: "2.2em" }}
          >
            {product.name}
          </h2>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p
              className="m-0 text-[0.92rem] font-bold tabular-nums"
              style={{ color: GOLD }}
            >
              {formatPrice(product.sellingPrice)}
            </p>
            <p className="m-0 text-[0.72rem] font-semibold" style={{ color: MUTED }}>
              المخزون:{" "}
              <span style={{ color: "#FFFFFF" }}>{product.stockQuantity}</span>
            </p>
          </div>
        </div>

        <div
          className="mt-2.5 flex items-center justify-end gap-2 px-2.5 py-2.5"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
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

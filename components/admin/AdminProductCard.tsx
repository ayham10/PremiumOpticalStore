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
  equal,
  size = 38,
}: {
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  equal?: boolean;
  size?: number;
}) {
  const btn = (
    kind: "edit" | "delete",
    onClick: () => void,
    disabled?: boolean,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={kind === "edit" ? "تعديل" : "حذف"}
      className="grid place-items-center rounded-[11px] transition hover:brightness-110 disabled:opacity-40"
      style={{
        width: equal ? "100%" : size,
        height: size,
        color: kind === "edit" ? GOLD : "#F07178",
        background:
          kind === "edit"
            ? "rgba(212,175,106,0.08)"
            : "rgba(240,113,120,0.08)",
        border:
          kind === "edit"
            ? "1px solid rgba(212,175,106,0.5)"
            : "1px solid rgba(240,113,120,0.45)",
      }}
    >
      {kind === "edit" ? (
        <Pencil size={16} strokeWidth={1.6} />
      ) : (
        <Trash2 size={16} strokeWidth={1.6} />
      )}
    </button>
  );

  if (equal) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {btn("edit", onEdit)}
        {btn("delete", onDelete, !canDelete)}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {btn("edit", onEdit)}
      {btn("delete", onDelete, !canDelete)}
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
      style={{
        background: "rgba(94,196,154,0.18)",
        color: "#5EC49A",
        border: "1px solid rgba(94,196,154,0.35)",
        visibility: isActive ? "visible" : "hidden",
      }}
    >
      نشط
    </span>
  );

  return (
    <article
      className="overflow-hidden"
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 15,
      }}
    >
      {/* MOBILE — horizontal card, image on the visual right (RTL start) */}
      <div
        className="flex items-stretch gap-3 p-2.5 md:hidden"
        style={{ minHeight: 130, maxHeight: 145 }}
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 105,
            height: 105,
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
          <div className="absolute end-1.5 top-1.5">{badge}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <h2
              className="m-0 line-clamp-2 text-[0.88rem] font-semibold leading-snug"
              style={{ color: "#FFFFFF" }}
            >
              {product.name}
            </h2>
            <p
              className="mb-0 mt-1.5 text-[0.92rem] font-bold tabular-nums"
              style={{ color: GOLD }}
            >
              {formatPrice(product.sellingPrice)}
            </p>
            <p
              className="mb-0 mt-1 text-[0.75rem] font-semibold"
              style={{ color: MUTED }}
            >
              المخزون:{" "}
              <span style={{ color: "#FFFFFF" }}>{product.stockQuantity}</span>
            </p>
          </div>
          <div className="mt-2 max-w-[7.5rem]">
            <ActionButtons
              equal
              size={34}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP — vertical catalogue card */}
      <div className="hidden h-full flex-col md:flex">
        <div
          className="relative w-full shrink-0 overflow-hidden"
          style={{
            background: PAGE_BG,
            aspectRatio: "1 / 1",
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
          <div className="absolute end-2.5 top-2.5">{badge}</div>
        </div>

        <div className="flex flex-1 flex-col px-3 pb-0 pt-2.5">
          <h2
            className="m-0 line-clamp-2 text-[0.86rem] font-semibold leading-snug"
            style={{ color: "#FFFFFF", minHeight: "2.25em" }}
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
            className="mb-0 mt-1 text-[0.74rem] font-semibold"
            style={{ color: MUTED }}
          >
            المخزون:{" "}
            <span style={{ color: "#FFFFFF" }}>{product.stockQuantity}</span>
          </p>
        </div>

        <div
          className="mt-2.5 px-2.5 py-2.5"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          <ActionButtons
            equal
            size={40}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

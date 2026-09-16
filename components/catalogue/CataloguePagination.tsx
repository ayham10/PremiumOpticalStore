"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Product } from "@/lib/types";

/** 3 columns × 3 rows on mobile and tablet. */
export const CATALOGUE_PAGE_SIZE_MOBILE = 9;
/** 4 columns × 3 rows at the existing 1280px catalogue breakpoint. */
export const CATALOGUE_PAGE_SIZE_DESKTOP = 12;

export function useCataloguePageSize() {
  const [pageSize, setPageSize] = useState(CATALOGUE_PAGE_SIZE_MOBILE);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () =>
      setPageSize(
        mq.matches ? CATALOGUE_PAGE_SIZE_DESKTOP : CATALOGUE_PAGE_SIZE_MOBILE,
      );
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return pageSize;
}

export function cataloguePageNumbers(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total]);
  for (let i = current - 1; i <= current + 1; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  if (current <= 3) {
    for (const n of [2, 3, 4]) {
      if (n < total) pages.add(n);
    }
  }
  if (current >= total - 2) {
    for (const n of [total - 3, total - 2, total - 1]) {
      if (n > 1) pages.add(n);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const n of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === "number" && n - prev > 1) {
      result.push("ellipsis");
    }
    result.push(n);
  }
  return result;
}

export function CataloguePagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLocale();
  const numbers = useMemo(
    () => cataloguePageNumbers(page, totalPages),
    [page, totalPages],
  );

  if (totalPages <= 1) return null;

  return (
    <nav className="catalogue-pagination" aria-label={t("shop.pagination")}>
      <button
        type="button"
        className="catalogue-pagination-btn catalogue-pagination-arrow"
        disabled={page <= 1}
        aria-label={t("shop.pagePrev")}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} strokeWidth={1.8} aria-hidden />
      </button>
      <ol className="catalogue-pagination-pages">
        {numbers.map((item, index) =>
          item === "ellipsis" ? (
            <li
              key={`ellipsis-${index}`}
              className="catalogue-pagination-ellipsis"
              aria-hidden
            >
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={`catalogue-pagination-btn${
                  item === page ? " is-active" : ""
                }`}
                aria-label={t("shop.page", { page: item })}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        className="catalogue-pagination-btn catalogue-pagination-arrow"
        disabled={page >= totalPages}
        aria-label={t("shop.pageNext")}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
      </button>
    </nav>
  );
}

export function CataloguePagedList({
  items,
  resetKey,
  gridClassName = "frames-product-grid",
  renderItem,
}: {
  items: Product[];
  resetKey: string;
  gridClassName?: string;
  renderItem: (product: Product) => ReactNode;
}) {
  const pageSize = useCataloguePageSize();
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef(resetKey);

  if (resetRef.current !== resetKey) {
    resetRef.current = resetKey;
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === currentPage) return;
    setPage(clamped);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={listRef} className="catalogue-paged-list">
      <div className={gridClassName}>
        {pageItems.map((product) => (
          <Fragment key={product.id}>{renderItem(product)}</Fragment>
        ))}
      </div>
      <CataloguePagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />
    </div>
  );
}

"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { saveNavReturn } from "@/lib/nav-return";
import {
  cachedJsonFetch,
  productSlugCacheKey,
} from "@/lib/public-data-cache";

type SaveReturnLinkProps = LinkProps & {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

function warmProduct(href: LinkProps["href"]) {
  const path = typeof href === "string" ? href : href.pathname || "";
  const match = path.match(/^\/product\/([^/?#]+)/);
  if (!match) return;
  const slug = decodeURIComponent(match[1]);
  void cachedJsonFetch(
    productSlugCacheKey(slug),
    `/api/products?slug=${encodeURIComponent(slug)}`,
  ).catch(() => undefined);
}

/** Link that records the current path + scroll before navigating to product details. */
export default function SaveReturnLink({
  children,
  onClick,
  href,
  ...props
}: SaveReturnLinkProps & {
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => warmProduct(href)}
      onFocus={() => warmProduct(href)}
      onTouchStart={() => warmProduct(href)}
      onClick={(e) => {
        saveNavReturn();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

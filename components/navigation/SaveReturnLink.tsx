"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
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

function warmProduct(href: LinkProps["href"], locale: string) {
  const path = typeof href === "string" ? href : href.pathname || "";
  const match = path.match(/^\/product\/([^/?#]+)/);
  if (!match) return;
  const slug = decodeURIComponent(match[1]);
  void cachedJsonFetch(
    productSlugCacheKey(slug, locale),
    `/api/products?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`,
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
  const { locale } = useLocale();
  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => warmProduct(href, locale)}
      onFocus={() => warmProduct(href, locale)}
      onTouchStart={() => warmProduct(href, locale)}
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

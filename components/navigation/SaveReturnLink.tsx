"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { saveNavReturn } from "@/lib/nav-return";

type SaveReturnLinkProps = LinkProps & {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

/** Link that records the current path + scroll before navigating to product details. */
export default function SaveReturnLink({
  children,
  onClick,
  ...props
}: SaveReturnLinkProps & {
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        saveNavReturn();
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}

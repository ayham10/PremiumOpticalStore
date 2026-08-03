"use client";

import { useEffect } from "react";
import { consumeScrollRestore } from "@/lib/nav-return";

/** Restores scroll after returning from product details. */
export default function ScrollRestore() {
  useEffect(() => {
    const y = consumeScrollRestore();
    if (y == null) return;

    const restore = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });
    restore();
    const t1 = window.setTimeout(restore, 50);
    const t2 = window.setTimeout(restore, 200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}

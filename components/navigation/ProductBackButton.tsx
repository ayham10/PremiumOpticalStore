"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  clearNavReturn,
  readNavReturn,
  stashScrollRestore,
} from "@/lib/nav-return";

export default function ProductBackButton() {
  const router = useRouter();
  const { t, rtl } = useLocale();

  function handleBack() {
    const ret = readNavReturn();
    if (ret) {
      stashScrollRestore(ret.scroll);
      clearNavReturn();
      router.push(ret.path);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/shop");
  }

  return (
    <button
      type="button"
      className="product-back-btn"
      onClick={handleBack}
      aria-label={t("product.back")}
    >
      <ArrowLeft
        size={16}
        strokeWidth={1.7}
        className={rtl ? "product-back-btn-icon is-rtl" : "product-back-btn-icon"}
      />
    </button>
  );
}

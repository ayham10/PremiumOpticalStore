"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type GalleryItem = {
  id: string;
  url: string;
  alt?: string;
};

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const { t } = useLocale();
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") {
        setActive((i) => (i === null ? i : (i + 1) % items.length));
      }
      if (e.key === "ArrowLeft") {
        setActive((i) =>
          i === null ? i : (i - 1 + items.length) % items.length
        );
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, items.length]);

  return (
    <>
      <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((item, i) => (
          <Reveal key={item.id} delay={(i % 6) * 50} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={() => setActive(i)}
              className="group relative block w-full overflow-hidden rounded-[var(--radius-sm)] text-start"
            >
              <Image
                src={item.url}
                alt={item.alt || "Oyon gallery"}
                width={800}
                height={1000}
                className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-0 bg-[var(--ink)]/0 transition group-hover:bg-[var(--ink)]/25" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 p-4 text-sm font-semibold text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {t("gallery.view")}
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      {active !== null && items[active] && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,14,20,0.88)] p-4 backdrop-blur-sm"
          style={{ animation: "fadeIn 0.25s ease both" }}
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t("gallery.eyebrow")}
        >
          <button
            type="button"
            className="absolute end-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setActive(null)}
            aria-label={t("gallery.close")}
          >
            <X size={20} />
          </button>
          <div
            className="relative max-h-[85vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={items[active].url}
              alt={items[active].alt || "Oyon gallery"}
              width={1400}
              height={1000}
              className="max-h-[85vh] w-auto rounded-[var(--radius-sm)] object-contain"
              style={{ animation: "fadeUp 0.35s ease both" }}
            />
            <div className="mt-4 flex items-center justify-between text-sm text-white/70">
              <button
                type="button"
                className="hover:text-white"
                onClick={() =>
                  setActive((i) =>
                    i === null ? i : (i - 1 + items.length) % items.length
                  )
                }
              >
                {t("gallery.previous")}
              </button>
              <span>
                {active + 1} / {items.length}
              </span>
              <button
                type="button"
                className="hover:text-white"
                onClick={() =>
                  setActive((i) => (i === null ? i : (i + 1) % items.length))
                }
              >
                {t("gallery.next")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

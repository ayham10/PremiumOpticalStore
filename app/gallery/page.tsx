import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import { getStore } from "@/lib/db/store";
import { GALLERY_IMAGES } from "@/lib/seed";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery — LUMINA",
  description: "Inside the LUMINA optical atelier in Tel Aviv.",
};

export default async function GalleryPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const fromStore = data.media.filter(
    (m) => m.folder === "gallery" && m.type === "image"
  );

  const items =
    fromStore.length > 0
      ? fromStore.map((m) => ({
          id: m.id,
          url: m.url,
          alt: m.alt || "LUMINA gallery",
        }))
      : GALLERY_IMAGES.map((url, i) => ({
          id: `seed-${i}`,
          url,
          alt: `LUMINA gallery ${i + 1}`,
        }));

  return (
    <div className="pb-20 pt-28">
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">{t(dict, "gallery.eyebrow")}</span>
          <h1 className="section-title">{t(dict, "gallery.title")}</h1>
          <p className="section-lead">{t(dict, "gallery.lead")}</p>
        </Reveal>
        <GalleryGrid items={items} />
      </div>
    </div>
  );
}

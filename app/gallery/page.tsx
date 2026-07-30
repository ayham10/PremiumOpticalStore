import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import { getStore } from "@/lib/db/store";
import { GALLERY_IMAGES } from "@/lib/seed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery — LUMINA",
  description: "Inside the LUMINA optical atelier in Tel Aviv.",
};

export default async function GalleryPage() {
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
          <span className="eyebrow">Gallery</span>
          <h1 className="section-title">Light, frames, atmosphere</h1>
          <p className="section-lead">
            A look inside the LUMINA atelier — fittings, silhouettes, and the
            quiet of precise optical care.
          </p>
        </Reveal>
        <GalleryGrid items={items} />
      </div>
    </div>
  );
}

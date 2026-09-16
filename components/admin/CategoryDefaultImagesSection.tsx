"use client";

import { ImageIcon } from "lucide-react";
import SingleImageField from "@/components/admin/SingleImageField";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CATEGORY_DEFAULT_IMAGE_KEYS } from "@/lib/product-images";
import type { CategoryDefaultImageKey, StoreSettings } from "@/lib/types";

type Props = {
  value: StoreSettings;
  onChange: (next: StoreSettings) => void;
};

export default function CategoryDefaultImagesSection({
  value,
  onChange,
}: Props) {
  const { t, dict } = useLocale();
  const images = value.categoryDefaultImages || {};

  function setCategoryImage(key: CategoryDefaultImageKey, url: string) {
    onChange({
      ...value,
      categoryDefaultImages: {
        ...images,
        [key]: url,
      },
    });
  }

  return (
    <section className="admin-card space-y-4 p-5">
      <div>
        <h2 className="admin-section-title admin-set-title">
          <ImageIcon size={16} strokeWidth={1.7} />
          {t("admin.settings.defaultProductImages")}
        </h2>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {t("admin.settings.defaultProductImagesHint")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {CATEGORY_DEFAULT_IMAGE_KEYS.map((key) => (
          <SingleImageField
            key={key}
            label={dict.shop.categories[key] || key}
            value={images[key] || ""}
            folder="general"
            onChange={(url) => setCategoryImage(key, url)}
          />
        ))}
      </div>
    </section>
  );
}

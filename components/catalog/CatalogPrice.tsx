import { formatPrice } from "@/lib/format";

export default function CatalogPrice({
  sellingPrice,
  discountedPrice,
  currencySymbol,
  className,
}: {
  sellingPrice: number;
  discountedPrice?: number;
  currencySymbol?: string;
  className?: string;
}) {
  const settings = currencySymbol ? { currencySymbol } : undefined;
  const onSale =
    typeof discountedPrice === "number" && discountedPrice < sellingPrice;
  if (!onSale) {
    return (
      <strong className={className}>{formatPrice(sellingPrice, settings)}</strong>
    );
  }
  return (
    <span className={className ? `${className} catalog-price` : "catalog-price"}>
      <s className="catalog-price-was">{formatPrice(sellingPrice, settings)}</s>
      <strong className="catalog-price-now">
        {formatPrice(discountedPrice, settings)}
      </strong>
    </span>
  );
}

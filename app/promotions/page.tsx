import type { Metadata } from "next";
import PromotionsExperience from "@/components/promotions/PromotionsExperience";
import { getStore } from "@/lib/db/store";
import { isPromotionActive } from "@/lib/appointments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promotions — Oyon Optical",
  description: "Current Oyon offers on exams, frames, and complete pairs.",
};

export default async function PromotionsPage() {
  const { data } = await getStore();

  const promotions = data.promotions
    .filter((p) => isPromotionActive(p.startDate, p.endDate, p.active))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.startDate.localeCompare(b.startDate);
    });

  // Highest priority = lowest priority number (matches admin ordering).
  const featured = promotions[0] ?? null;

  const products = data.products
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      const af = a.featured ? 0 : 1;
      const bf = b.featured ? 0 : 1;
      if (af !== bf) return af - bf;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 12);

  return (
    <PromotionsExperience
      featured={featured}
      promotions={promotions}
      products={products}
    />
  );
}

import type { Metadata } from "next";
import PromotionsPageClient from "@/components/promotions/PromotionsPageClient";

export const metadata: Metadata = {
  title: "Promotions — Oyon Optical",
  description: "Current Oyon offers on exams, frames, and complete pairs.",
};

/** Instant shell — slides load via cached client fetch (no Supabase block). */
export default function PromotionsPage() {
  return <PromotionsPageClient />;
}

import type { Metadata } from "next";
import SunglassesCatalogue from "@/components/sunglasses/SunglassesCatalogue";

export const metadata: Metadata = {
  title: "Sunglasses | Oyon Optical",
  description:
    "Discover premium sunglasses designed for protection, comfort and effortless style.",
};

export default function SunglassesPage() {
  return <SunglassesCatalogue />;
}

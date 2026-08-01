import type { Metadata } from "next";
import NavigationHub from "@/components/home/NavigationHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LUMINA — Premium Optical Navigation",
  description:
    "Choose eye exams, premium frames, sunglasses, contact lenses, booking, and more — instantly.",
};

export default function HomePage() {
  return <NavigationHub />;
}

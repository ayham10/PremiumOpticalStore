import type { Metadata } from "next";
import WelcomeSection from "@/components/home/WelcomeSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OYON Optical — See Life in Focus",
  description:
    "Premium eyewear, professional eye exams, and luxury frames. OYON Optical — Deir Hanna.",
};

export default function HomePage() {
  return (
    <div className="home-page">
      <WelcomeSection />
    </div>
  );
}

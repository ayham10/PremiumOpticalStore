import type { Metadata } from "next";
import WelcomeSection from "@/components/home/WelcomeSection";
import NavigationHub from "@/components/home/NavigationHub";
import HomeFooter from "@/components/home/HomeFooter";
import HomeAtmosphere from "@/components/home/HomeAtmosphere";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LUMINA Optical — See Life in Focus",
  description:
    "Premium optical navigation. Explore frames, eye exams, sunglasses, contact lenses, promotions, and booking.",
};

export default function HomePage() {
  return (
    <div className="home-page">
      <WelcomeSection />
      <div id="home-hub" className="home-hub-wrap">
        <HomeAtmosphere />
        <div className="home-page-content">
          <NavigationHub />
          <HomeFooter />
        </div>
      </div>
    </div>
  );
}

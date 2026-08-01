import type { Metadata } from "next";
import WelcomeVideo from "@/components/home/WelcomeVideo";
import NavigationHub from "@/components/home/NavigationHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LUMINA Optical — See Life in Focus",
  description:
    "Premium eyewear, advanced eye care, and effortless booking. Explore frames, exams, sunglasses, and contact lenses.",
};

export default function HomePage() {
  return (
    <div className="home-page">
      <WelcomeVideo />
      <NavigationHub />
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import IntroLoader from "@/components/home/IntroLoader";

export default function ConditionalChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isHome = pathname === "/";

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <IntroLoader />
      <Navbar />
      <main className={isHome ? "home-main" : undefined}>{children}</main>
      {isHome ? null : <Footer />}
      <WhatsAppButton />
    </>
  );
}

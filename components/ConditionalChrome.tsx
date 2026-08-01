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
  const isFrames = pathname === "/frames";
  const isProduct = pathname?.startsWith("/product/") ?? false;
  const isEyeExam = pathname === "/eye-exams";

  if (isAdmin) {
    return <>{children}</>;
  }

  const mainClass = isHome
    ? "home-main"
    : isFrames
      ? "frames-main"
      : isProduct
        ? "product-main"
        : isEyeExam
          ? "eye-exam-main"
          : undefined;

  return (
    <>
      {isHome ? <IntroLoader /> : null}
      <Navbar />
      <main className={mainClass}>{children}</main>
      {isHome ? null : <Footer />}
      {isHome ? null : <WhatsAppButton />}
    </>
  );
}

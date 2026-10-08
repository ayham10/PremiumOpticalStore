import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Booking manage test",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function BookingManageTestLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    const session = await requireSession();
    if (session.role !== "admin") redirect("/admin");
  } catch {
    redirect("/admin/login");
  }
  return children;
}

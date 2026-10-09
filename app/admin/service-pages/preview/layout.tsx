import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OYON content preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ContentPreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireSession("settings");
  } catch {
    redirect("/admin/login");
  }
  return children;
}

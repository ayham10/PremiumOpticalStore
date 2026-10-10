import type { Metadata } from "next";
import ManageBookingClient from "@/components/booking/ManageBookingClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "إدارة الموعد",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function BookingManageTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ManageBookingClient token={token} />;
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import ConditionalChrome from "@/components/ConditionalChrome";

export const metadata: Metadata = {
  title: "LUMINA — Premium Optical Store & Eye Examinations",
  description:
    "Book eye exams, discover prescription glasses, sunglasses, and contact lenses. Premium optical care with precise fittings.",
  keywords:
    "optical store, eye exam, prescription glasses, sunglasses, contact lenses, optometrist, LUMINA",
  openGraph: {
    title: "LUMINA — Premium Optical",
    description: "Precision vision. Quiet luxury.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConditionalChrome>{children}</ConditionalChrome>
      </body>
    </html>
  );
}

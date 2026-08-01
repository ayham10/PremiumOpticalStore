import type { Metadata, Viewport } from "next";
import "./globals.css";
import ConditionalChrome from "@/components/ConditionalChrome";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { isRtl } from "@/lib/i18n/config";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body>
        <LocaleProvider locale={locale} dict={dict}>
          <ConditionalChrome>{children}</ConditionalChrome>
        </LocaleProvider>
      </body>
    </html>
  );
}

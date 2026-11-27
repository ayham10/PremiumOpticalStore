"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getGoogleAnalyticsId } from "@/lib/google-analytics";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return !pathname.startsWith("/admin");
}

/**
 * GA4 on public routes only. Scripts use fixed ids so Next.js does not double-load.
 * Manual page_view events support App Router client navigations.
 */
export default function PublicGoogleAnalytics() {
  const pathname = usePathname();
  const gaId = getGoogleAnalyticsId();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!gaId || !isPublic || !pathname) return;
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      send_to: gaId,
    });
  }, [pathname, isPublic, gaId]);

  if (!gaId || !isPublic) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="oyon-google-analytics" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { send_page_view: false });
`}
      </Script>
    </>
  );
}
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";

function detectLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  // New visits default to Arabic (RTL). Manual language choice is preserved via cookie.
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const locale = detectLocale(request);
  const response = NextResponse.next();
  response.headers.set("x-lumina-locale", locale);

  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|videos/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};

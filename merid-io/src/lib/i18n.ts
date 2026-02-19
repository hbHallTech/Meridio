import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as string | undefined;

  // Fallback: read NEXT_LOCALE cookie (set by sidebar language toggle)
  if (!locale || !locales.includes(locale as Locale)) {
    try {
      const cookieStore = await cookies();
      const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
      if (cookieLocale && locales.includes(cookieLocale as Locale)) {
        locale = cookieLocale;
      }
    } catch {
      // cookies() may throw in edge cases; ignore
    }
  }

  const resolvedLocale = locale && locales.includes(locale as Locale) ? locale : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: (await import(`@/messages/${resolvedLocale}.json`)).default,
  };
});

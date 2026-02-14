"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTransition } from "react";
import { Globe, Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const { update } = useSession();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;

    startTransition(async () => {
      // Persist to DB via session update
      await update({ language: newLocale });
      // Navigate to same path with new locale
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-400" />
      <span className="text-sm text-gray-500">{t("language")}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => switchLocale("fr")}
          disabled={isPending}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            locale === "fr"
              ? "bg-[#1B3A5C] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          FR
        </button>
        <button
          onClick={() => switchLocale("en")}
          disabled={isPending}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            locale === "en"
              ? "bg-[#1B3A5C] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          EN
        </button>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      </div>
    </div>
  );
}

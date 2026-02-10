"use client";

import { useTranslations } from "next-intl";

export default function Verify2FAPage() {
  const t = useTranslations("auth");

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t("twoFactor")}</h1>
        <p className="text-muted-foreground">{t("enterCode")}</p>
      </div>
      <form className="space-y-4">
        <div>
          <input
            type="text"
            maxLength={6}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-center text-2xl tracking-widest"
            placeholder="000000"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Vérifier
        </button>
      </form>
    </div>
  );
}

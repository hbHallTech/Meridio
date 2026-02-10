"use client";

import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t("resetPassword")}</h1>
      </div>
      <form className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            placeholder="email@example.com"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          {t("resetPassword")}
        </button>
      </form>
    </div>
  );
}

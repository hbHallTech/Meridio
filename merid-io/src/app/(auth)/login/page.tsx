"use client";

import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("auth");

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Meridio</h1>
        <p className="text-muted-foreground">{t("login")}</p>
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
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          {t("signIn")}
        </button>
        <div className="text-center">
          <a href="/forgot-password" className="text-sm text-muted-foreground hover:underline">
            {t("forgotPassword")}
          </a>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { LogOut, User } from "lucide-react";

export function Header() {
  const t = useTranslations("auth");

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <User className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
          <span>{t("logout")}</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect from old /hr/documents-settings to /admin/company (Documents tab).
 * This page has been moved to the Company Settings under Admin.
 */
export default function DocumentsSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/company?tab=documents");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

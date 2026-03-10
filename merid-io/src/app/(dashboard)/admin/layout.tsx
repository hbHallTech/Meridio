import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  // HR, ADMIN, and SUPER_ADMIN can access admin pages.
  // Fine-grained route restrictions (e.g. HR only sees /admin/users)
  // are enforced by the middleware RBAC in auth.config.ts.
  if (
    !roles.includes("HR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("SUPER_ADMIN")
  ) {
    console.warn(
      `[RBAC/layout] Admin access denied: user=${session?.user?.id ?? "anonymous"} roles=[${roles}]`
    );
    redirect("/");
  }

  return <>{children}</>;
}

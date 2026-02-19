import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    console.warn(
      `[RBAC/layout] Admin access denied: user=${session?.user?.id ?? "anonymous"} roles=[${roles}]`
    );
    redirect("/");
  }

  return <>{children}</>;
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("MANAGER") && !roles.includes("ADMIN")) {
    console.warn(
      `[RBAC/layout] Manager access denied: user=${session?.user?.id ?? "anonymous"} roles=[${roles}]`
    );
    redirect("/");
  }

  return <>{children}</>;
}

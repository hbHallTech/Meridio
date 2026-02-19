import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("HR") && !roles.includes("ADMIN")) {
    console.warn(
      `[RBAC/layout] HR access denied: user=${session?.user?.id ?? "anonymous"} roles=[${roles}]`
    );
    redirect("/");
  }

  return <>{children}</>;
}

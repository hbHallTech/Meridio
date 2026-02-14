import { useTranslations } from "next-intl";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: "#1B3A5C" }}>
        <div>
          <h1 className="text-3xl font-bold text-white">{tc("companyName")}</h1>
          <p className="mt-1 text-sm" style={{ color: "#00BCD4" }}>
            {tc("tagline")}
          </p>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,188,212,0.15)" }}>
                <svg className="h-5 w-5" style={{ color: "#00BCD4" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t("features.simplified")}</p>
                <p className="text-xs text-white/60">{t("features.simplifiedDesc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,188,212,0.15)" }}>
                <svg className="h-5 w-5" style={{ color: "#00BCD4" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t("features.teamView")}</p>
                <p className="text-xs text-white/60">{t("features.teamViewDesc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(0,188,212,0.15)" }}>
                <svg className="h-5 w-5" style={{ color: "#00BCD4" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t("features.tracking")}</p>
                <p className="text-xs text-white/60">{t("features.trackingDesc")}</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} {tc("companyName")} SA. {tc("allRights")}
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

import { MeridioLoginStory } from "@/components/MeridioLoginStory";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel – animated hero (desktop only) */}
      <div
        className="hidden lg:flex lg:w-1/2"
        style={{ backgroundColor: "#0b2540" }}
      >
        <MeridioLoginStory />
      </div>

      {/* Right panel – form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

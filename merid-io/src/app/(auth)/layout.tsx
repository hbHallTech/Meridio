import { MeridioLoginStory } from "@/components/MeridioLoginStory";
import { MeridioLogo } from "@/components/MeridioLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel – animated hero (desktop only) */}
      <div
        className="hidden lg:flex lg:w-[52%]"
        style={{ backgroundColor: "#0b2540" }}
      >
        <MeridioLoginStory />
      </div>

      {/* Right panel – form + copyright */}
      <div className="flex w-full lg:w-[48%] flex-col items-center justify-center bg-gray-50 p-6">
        {/* Mobile header */}
        <div className="mb-8 flex justify-center lg:hidden">
          <MeridioLogo height={28} textColor="#1B3A5C" />
        </div>

        <div className="w-full max-w-md flex-1 flex items-center">
          <div className="w-full">{children}</div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Halley-Technologies SA. Tous droits
          réservés.
        </p>
      </div>
    </div>
  );
}

"use client";

import { ShieldOff } from "lucide-react";
import { MeridioLogo } from "@/components/MeridioLogo";

/**
 * Access Denied page – standalone (not in sidebar).
 * Used as a redirect target for IPs blocked by the Vercel Firewall.
 */
export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <MeridioLogo height={32} textColor="#0b2540" />
        </div>

        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="h-10 w-10 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Accès refusé
        </h1>
        <p className="mb-1 text-sm font-medium text-gray-500">
          Access Denied
        </p>

        {/* Description */}
        <p className="mt-4 text-gray-600">
          Votre adresse IP ou votre localisation a été bloquée par notre
          pare-feu. Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur,
          veuillez contacter l&apos;administrateur.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Your IP address or location has been blocked by our firewall. If you
          believe this is an error, please contact the administrator.
        </p>

        {/* Divider */}
        <hr className="my-8 border-gray-200" />

        {/* Footer */}
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Halley-Technologies SA. Tous droits
          réservés.
        </p>
      </div>
    </div>
  );
}

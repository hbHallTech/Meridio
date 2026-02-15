"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    reason === "inactivity"
      ? "Vous avez été déconnecté - Session expirée"
      : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        const err = result.error;
        if (err.includes("MISSING_CREDENTIALS")) {
          setError("Veuillez remplir tous les champs.");
        } else if (err.includes("ACCOUNT_LOCKED")) {
          const minutes = err.split(":")[1] || "15";
          setError(
            `Compte verrouillé suite à trop de tentatives. Réessayez dans ${minutes} min.`
          );
        } else if (err.includes("PASSWORD_EXPIRED_RESET")) {
          setError("");
          setInfo(
            "Votre mot de passe a expire et a ete reinitialise. Un email contenant votre nouveau mot de passe temporaire vous a ete envoye."
          );
        } else if (err.includes("INVALID_CREDENTIALS")) {
          const remaining = err.split(":")[1];
          if (remaining) {
            setError(
              `Identifiants incorrects. ${remaining} tentative(s) restante(s) avant blocage.`
            );
          } else {
            setError("Identifiants incorrects.");
          }
        } else {
          setError("Identifiants incorrects.");
        }
      } else {
        // Login succeeded — send 2FA code and redirect to verify
        try {
          const res = await fetch("/api/auth/2fa/send", { method: "POST" });
          const data = await res.json();
          if (data.skipped) {
            router.push(callbackUrl);
            return;
          }
        } catch {
          // Continue even if 2FA send fails (dev mode without SMTP)
        }
        router.push("/login/verify");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  const isValidEmail = email.endsWith("@halley-technologies.ch");

  return (
    <div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Connexion</h2>
          <p className="mt-1 text-sm text-gray-500">
            Accédez à votre espace de gestion des congés
          </p>
        </div>

        {info && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {info}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                placeholder="prenom.nom@halley-technologies.ch"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            {email.length > 0 && !email.includes("@") ? null : email.length > 3 &&
              !isValidEmail &&
              email.includes("@") ? (
              <p className="mt-1 text-xs text-amber-600">
                L&apos;email doit être @halley-technologies.ch
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                placeholder="Votre mot de passe"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium hover:underline"
              style={{ color: "#00BCD4" }}
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isValidEmail || !password}
            className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validators";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const isValidPassword = passwordRegex.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Lien de réinitialisation invalide.");
      return;
    }

    if (!isValidPassword) {
      setError(PASSWORD_RULES);
      return;
    }

    if (!passwordsMatch) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <div className="rounded-xl border bg-white p-8 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Link
            href="/forgot-password"
            className="text-sm font-medium hover:underline"
            style={{ color: "#00BCD4" }}
          >
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="rounded-xl border bg-white p-8 shadow-sm text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <CheckCircle className="h-7 w-7" style={{ color: "#00BCD4" }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Mot de passe modifié
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Votre mot de passe a été réinitialisé avec succès.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center lg:hidden">
        <h1 className="text-2xl font-bold" style={{ color: "#1B3A5C" }}>
          Halley-Technologies
        </h1>
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Nouveau mot de passe
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                placeholder="Min. 8 caractères"
                required
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
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <PasswordRule ok={password.length >= 8} text="8 caractères minimum" />
                <PasswordRule ok={/[A-Z]/.test(password)} text="1 majuscule" />
                <PasswordRule ok={/[a-z]/.test(password)} text="1 minuscule" />
                <PasswordRule ok={/\d/.test(password)} text="1 chiffre" />
                <PasswordRule ok={/[@$!%*?&]/.test(password)} text="1 caractère spécial (@$!%*?&)" />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                placeholder="Retapez le mot de passe"
                required
                disabled={isLoading}
              />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">
                Les mots de passe ne correspondent pas
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isValidPassword || !passwordsMatch}
            className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Réinitialisation...
              </>
            ) : (
              "Réinitialiser le mot de passe"
            )}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: "#1B3A5C" }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordRule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={ok ? "text-green-500" : "text-gray-400"}>
        {ok ? "✓" : "○"}
      </span>
      <span className={ok ? "text-green-700" : "text-gray-500"}>{text}</span>
    </div>
  );
}

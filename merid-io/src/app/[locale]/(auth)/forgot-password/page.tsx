"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Une erreur est survenue.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  const isValidEmail = email.endsWith("@halley-technologies.ch");

  if (sent) {
    return (
      <div>
        <div className="mb-8 text-center lg:hidden">
          <h1 className="text-2xl font-bold" style={{ color: "#1B3A5C" }}>
            Halley-Technologies
          </h1>
        </div>

        <div className="rounded-xl border bg-white p-8 shadow-sm text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <CheckCircle className="h-7 w-7" style={{ color: "#00BCD4" }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email envoyé</h2>
          <p className="text-sm text-gray-500 mb-6">
            Si l&apos;adresse <strong>{email}</strong> est associée à un compte,
            vous recevrez un lien de réinitialisation.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Vérifiez également votre dossier spam. Le lien expire dans 1 heure.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            style={{ color: "#1B3A5C" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
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
          <h2 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h2>
          <p className="mt-1 text-sm text-gray-500">
            Saisissez votre adresse email pour recevoir un lien de réinitialisation.
          </p>
        </div>

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
            {email.length > 3 && email.includes("@") && !isValidEmail && (
              <p className="mt-1 text-xs text-amber-600">
                L&apos;email doit être @halley-technologies.ch
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isValidEmail}
            className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              "Envoyer le lien"
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

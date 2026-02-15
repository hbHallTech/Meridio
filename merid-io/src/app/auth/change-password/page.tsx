"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, ShieldAlert, Check, X } from "lucide-react";

function getPasswordChecks(password: string) {
  return [
    { key: "length", label_fr: "8 caracteres minimum", label_en: "8 characters minimum", ok: password.length >= 8 },
    { key: "upper", label_fr: "1 majuscule", label_en: "1 uppercase letter", ok: /[A-Z]/.test(password) },
    { key: "lower", label_fr: "1 minuscule", label_en: "1 lowercase letter", ok: /[a-z]/.test(password) },
    { key: "digit", label_fr: "1 chiffre", label_en: "1 digit", ok: /\d/.test(password) },
    { key: "special", label_fr: "1 caractere special", label_en: "1 special character", ok: /[^A-Za-z\d\s]/.test(password) },
  ];
}

export default function ForceChangePasswordPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const lang = session?.user?.language ?? "fr";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/;
  const isValidPassword = passwordRegex.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const pwdChecks = getPasswordChecks(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (lang === "en" ? "An error occurred." : "Une erreur est survenue."));
        return;
      }

      // Update session to clear forcePasswordChange
      await updateSession({ forcePasswordChange: false });

      router.push("/dashboard");
    } catch {
      setError(lang === "en" ? "An error occurred." : "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
            >
              <ShieldAlert className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {lang === "en" ? "Change Your Password" : "Changez votre mot de passe"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {lang === "en"
                ? "You must change your password before continuing."
                : "Vous devez changer votre mot de passe avant de continuer."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current password */}
            <div>
              <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Current password" : "Mot de passe actuel"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === "en" ? "New password" : "Nouveau mot de passe"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                  placeholder={lang === "en" ? "Min. 8 characters" : "Min. 8 caracteres"}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pwdChecks.map((check) => (
                    <div key={check.key} className="flex items-center gap-2">
                      {check.ok ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-gray-300" />
                      )}
                      <span className={`text-xs ${check.ok ? "text-green-600" : "text-gray-400"}`}>
                        {lang === "en" ? check.label_en : check.label_fr}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Confirm new password" : "Confirmer le nouveau mot de passe"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                  required
                  disabled={isLoading}
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">
                  {lang === "en"
                    ? "Passwords do not match"
                    : "Les mots de passe ne correspondent pas"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValidPassword || !passwordsMatch || !currentPassword}
              className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {lang === "en" ? "Changing..." : "Modification..."}
                </>
              ) : (
                lang === "en" ? "Change password" : "Changer le mot de passe"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

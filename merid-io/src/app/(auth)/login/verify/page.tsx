"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, RotateCcw } from "lucide-react";

export default function Verify2FAPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every((d) => d !== "")) {
      handleVerify(newCode.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  }

  async function handleVerify(codeStr?: string) {
    const fullCode = codeStr || code.join("");
    if (fullCode.length !== 6) {
      setError("Veuillez saisir le code complet à 6 chiffres.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Code invalide");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setSuccess(true);
        await update({ twoFactorVerified: true });
        router.push("/dashboard");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setError("");

    try {
      await fetch("/api/auth/2fa/send", { method: "POST" });
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Impossible de renvoyer le code.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center lg:hidden">
        <h1 className="text-2xl font-bold" style={{ color: "#1B3A5C" }}>
          Halley-Technologies
        </h1>
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <ShieldCheck className="h-7 w-7" style={{ color: "#00BCD4" }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Vérification</h2>
          <p className="mt-2 text-sm text-gray-500">
            Un code à 6 chiffres a été envoyé à
          </p>
          {session?.user?.email && (
            <p className="mt-1 text-sm font-medium" style={{ color: "#1B3A5C" }}>
              {session.user.email}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700">
            Code vérifié ! Redirection en cours...
          </div>
        )}

        <div className="space-y-6">
          {/* 6-digit code input */}
          <div className="flex justify-center gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="h-12 w-12 rounded-lg border-2 border-gray-300 bg-white text-center text-xl font-bold transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 disabled:opacity-50"
                disabled={isVerifying || success}
              />
            ))}
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || success || code.some((d) => !d)}
            className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              "Vérifier le code"
            )}
          </button>

          <div className="text-center">
            <p className="mb-2 text-xs text-gray-400">
              Le code expire dans 10 minutes
            </p>
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: "#00BCD4" }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resendCooldown > 0
                ? `Renvoyer dans ${resendCooldown}s`
                : isResending
                  ? "Envoi..."
                  : "Renvoyer le code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

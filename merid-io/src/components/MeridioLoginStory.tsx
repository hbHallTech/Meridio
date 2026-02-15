"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, CheckCircle2, Sparkles } from "lucide-react";

// ─── Scene data ──────────────────────────────────────────────────────────────

interface Scene {
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  roleChip: string;
  aiChip: string;
  accent: string; // tailwind ring/border accent for chip
}

const SCENES: Scene[] = [
  {
    kicker: "Scène 1 — Employé",
    title: "Demande en 30 secondes",
    description: "Congé ou note de frais, guidé pas à pas.",
    bullets: [
      "Formulaire intelligent (dates, motif, justificatifs)",
      "Solde et calendrier visibles immédiatement",
      "Assistant IA : suggestions + contrôle d'erreurs",
    ],
    roleChip: "Employé",
    aiChip: "AI Assistant (Employé)",
    accent: "#00BCD4",
  },
  {
    kicker: "Scène 2 — Manager",
    title: "Approbation éclair",
    description: "Tout est clair, décision rapide, zéro ping-pong.",
    bullets: [
      "Vue équipe + conflits de planning",
      "Un clic : approuver / demander un ajustement",
      "Assistant IA : résumé + impact équipe",
    ],
    roleChip: "Manager",
    aiChip: "AI Assistant (Manager)",
    accent: "#7c3aed",
  },
  {
    kicker: "Scène 3 — RH / Finance",
    title: "Contrôle & traçabilité",
    description: "Validation, reporting et conformité, sans friction.",
    bullets: [
      "Historique complet + statuts en temps réel",
      "Règles & politiques configurables",
      "Assistant IA : check conformité + réponse aux questions",
    ],
    roleChip: "RH / Finance",
    aiChip: "AI Assistant (RH/Finance)",
    accent: "#10b981",
  },
];

const SCENE_DURATION = 3200;

// ─── Component ───────────────────────────────────────────────────────────────

export function MeridioLoginStory() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % SCENES.length);
    setProgress(0);
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          next();
          return 0;
        }
        return p + 100 / (SCENE_DURATION / 50);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [paused, next]);

  function goTo(index: number) {
    setActive(index);
    setProgress(0);
  }

  const scene = SCENES[active];

  return (
    <div
      className="meridio-story relative flex h-full flex-col justify-between overflow-hidden p-10 xl:p-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Background blobs ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Blob 1 - teal */}
        <div
          className="meridio-blob absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full opacity-25 blur-[100px]"
          style={{ background: "#00BCD4", animationDelay: "0s" }}
        />
        {/* Blob 2 - purple */}
        <div
          className="meridio-blob absolute -bottom-20 right-10 h-[350px] w-[350px] rounded-full opacity-20 blur-[100px]"
          style={{ background: "#7c3aed", animationDelay: "-2s" }}
        />
        {/* Blob 3 - blue */}
        <div
          className="meridio-blob absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[100px]"
          style={{ background: "#3b82f6", animationDelay: "-4s" }}
        />
        {/* Noise overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }} />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* ── Top: branding ── */}
      <div className="relative z-10">
        <h1 className="text-2xl font-bold text-white xl:text-3xl">Halley-Technologies</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: "#00BCD4" }}>
          Meridio — Gestion des congés
        </p>
      </div>

      {/* ── Middle: scene content ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-8">
        <div
          key={active}
          className="meridio-scene-enter space-y-5"
        >
          {/* Kicker */}
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            {scene.kicker}
          </p>

          {/* Title */}
          <h2 className="text-3xl font-extrabold leading-tight text-white xl:text-4xl">
            {scene.title}
          </h2>

          {/* Description */}
          <p className="max-w-md text-base leading-relaxed text-white/70">
            {scene.description}
          </p>

          {/* Bullets */}
          <ul className="space-y-2.5 pt-1">
            {scene.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/80">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: scene.accent }}
                />
                {b}
              </li>
            ))}
          </ul>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md"
              style={{
                borderColor: `${scene.accent}40`,
                backgroundColor: `${scene.accent}15`,
                color: scene.accent,
              }}
            >
              <Sparkles className="h-3 w-3" />
              {scene.roleChip}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur-md"
            >
              <Bot className="h-3 w-3" />
              {scene.aiChip}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom: hint + progress + dots ── */}
      <div className="relative z-10 space-y-4">
        {/* Hint */}
        <p className="text-xs text-white/30">
          Workflow clair &bull; Notifications &bull; Suivi temps réel
        </p>

        {/* Progress bar */}
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              backgroundColor: scene.accent,
            }}
          />
        </div>

        {/* Dots + copyright */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {SCENES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Aller à ${s.kicker}`}
                className="group relative h-2.5 w-2.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === active ? s.accent : "rgba(255,255,255,0.2)",
                  transform: i === active ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
          <p className="text-[10px] text-white/30">
            &copy; {new Date().getFullYear()} Halley-Technologies SA
          </p>
        </div>
      </div>

      {/* ── Inline styles (CSS animations) ── */}
      <style jsx>{`
        /* Blob floating animation */
        .meridio-blob {
          animation: meridio-float 8s ease-in-out infinite;
        }
        @keyframes meridio-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.05); }
          66% { transform: translate(-10px, 12px) scale(0.95); }
        }

        /* Scene enter animation */
        .meridio-scene-enter {
          animation: meridio-fade-up 0.5s ease-out both;
        }
        @keyframes meridio-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Respect prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .meridio-blob { animation: none !important; }
          .meridio-scene-enter { animation: none !important; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

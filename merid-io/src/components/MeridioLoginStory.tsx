"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Scene data ──────────────────────────────────────────────────────────────

interface Scene {
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  roleChip: string;
  aiChip: string;
  kpi1: string;
  kpi2: string;
  panelTitle: string;
  primaryBtn: string;
  activeTile: number;
}

const SCENES: Scene[] = [
  {
    kicker: "Scène 1 — Collaborateur",
    title: "Demande en 30 secondes",
    description: "Congé ou note de frais, guidé pas à pas.",
    bullets: [
      "Formulaire intelligent (dates, motif, justificatifs)",
      "Solde et calendrier visibles immédiatement",
      "Assistant IA : suggestions + contrôle d'erreurs",
    ],
    roleChip: "Employé",
    aiChip: "AI Assistant (Employé)",
    kpi1: "18.5 j",
    kpi2: "Brouillon",
    panelTitle: "Demande",
    primaryBtn: "Soumettre",
    activeTile: 1,
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
    kpi1: "Équipe",
    kpi2: "À valider",
    panelTitle: "Approbation",
    primaryBtn: "Approuver",
    activeTile: 2,
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
    kpi1: "Conformité",
    kpi2: "Validé",
    panelTitle: "Contrôle",
    primaryBtn: "Soumettre",
    activeTile: 3,
  },
];

const SCENE_DURATION = 5200;

// ─── Component ───────────────────────────────────────────────────────────────

export function MeridioLoginStory() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const animateBar = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.transform = "scaleX(0)";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = `transform ${SCENE_DURATION}ms linear`;
        bar.style.transform = "scaleX(1)";
      });
    });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setActive(index);
      animateBar();
    },
    [animateBar],
  );

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    animateBar();
    const timer = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % SCENES.length;
        return next;
      });
      animateBar();
    }, SCENE_DURATION);
    return () => clearInterval(timer);
  }, [paused, animateBar]);

  const scene = SCENES[active];

  return (
    <div
      className="mls-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Merid.io story"
    >
      {/* ── Background ── */}
      <div className="mls-bg">
        <div className="mls-blob mls-b1" />
        <div className="mls-blob mls-b2" />
        <div className="mls-blob mls-b3" />
        <div className="mls-noise" />
        <div className="mls-grid" />
      </div>

      {/* ── Content ── */}
      <div className="mls-content">
        {/* Header: brand + chips */}
        <header className="mls-top">
          <div className="mls-brand">
            <div className="mls-logo-mark" aria-hidden="true" />
            <div>
              <div className="mls-brand-name">Halley-Technologies</div>
              <div className="mls-brand-sub">
                Merid.io — Gestion des congés &amp; notes de frais
              </div>
            </div>
          </div>
          <div className="mls-chips" key={active}>
            <span className="mls-chip">{scene.roleChip}</span>
            <span className="mls-chip mls-chip-ai">{scene.aiChip}</span>
          </div>
        </header>

        {/* Stage: copy + mock card */}
        <div className="mls-stage">
          {/* Left copy */}
          <div className="mls-copy" key={active}>
            <div className="mls-kicker">{scene.kicker}</div>
            <h2 className="mls-title">{scene.title}</h2>
            <p className="mls-desc">{scene.description}</p>
            <ul className="mls-bullets">
              {scene.bullets.map((b) => (
                <li key={b}>
                  <span className="mls-dot" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mls-hint">
              Workflow clair &bull; Notifications &bull; Suivi temps réel
            </div>
          </div>

          {/* Right mock card */}
          <div className="mls-mock-wrap" aria-hidden="true">
            <div className="mls-mock-card" key={active}>
              {/* Tab bar */}
              <div className="mls-mock-top">
                <div className="mls-pill" />
                <div className="mls-pill mls-pill-sm" />
                <div className="mls-pill mls-pill-sm" />
              </div>
              <div className="mls-mock-body">
                {/* KPIs */}
                <div className="mls-row">
                  <div className="mls-kpi">
                    <div className="mls-kpi-label">Solde</div>
                    <div className="mls-kpi-value">{scene.kpi1}</div>
                  </div>
                  <div className="mls-kpi">
                    <div className="mls-kpi-label">Statut</div>
                    <div className="mls-kpi-value">{scene.kpi2}</div>
                  </div>
                </div>
                {/* Panel */}
                <div className="mls-panel">
                  <div className="mls-panel-title">
                    <span>{scene.panelTitle}</span>
                    <span className="mls-ai-tag">AI</span>
                  </div>
                  <div className="mls-lines">
                    <div className="mls-line" style={{ width: "90%" }} />
                    <div className="mls-line" style={{ width: "70%" }} />
                    <div className="mls-line" style={{ width: "80%" }} />
                  </div>
                  <div className="mls-btn-row">
                    <span className="mls-btn-mini">Prévisualiser</span>
                    <span className="mls-btn-mini mls-btn-primary">
                      {scene.primaryBtn}
                    </span>
                  </div>
                </div>
                {/* Tiles */}
                <div className="mls-mini-grid">
                  <div className={`mls-tile${scene.activeTile === 1 ? " mls-tile-active" : ""}`}>
                    Calendrier
                  </div>
                  <div className={`mls-tile${scene.activeTile === 2 ? " mls-tile-active" : ""}`}>
                    Équipe
                  </div>
                  <div className={`mls-tile${scene.activeTile === 3 ? " mls-tile-active" : ""}`}>
                    Reporting
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: dots + progress */}
        <footer className="mls-bottom">
          <div className="mls-dots" aria-label="Navigation scènes">
            {SCENES.map((_, i) => (
              <button
                key={i}
                className={`mls-dot-btn${i === active ? " mls-dot-active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Aller à la scène ${i + 1}`}
              />
            ))}
          </div>
          <div className="mls-progress">
            <div className="mls-bar" ref={barRef} />
          </div>
        </footer>
      </div>

      {/* ── Scoped styles ── */}
      <style jsx>{`
        /* Root */
        .mls-root {
          position: relative;
          width: 100%;
          height: 100%;
          padding: 22px;
          display: flex;
          align-items: stretch;
          justify-items: stretch;
          color: #eef6ff;
        }

        /* Background */
        .mls-bg { position: absolute; inset: 0; overflow: hidden; }
        .mls-blob {
          position: absolute;
          width: 520px; height: 520px;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0.22;
          will-change: transform;
          animation: mls-float 10s ease-in-out infinite;
        }
        .mls-b1 { left: -160px; top: -180px; background: #2c90ff; }
        .mls-b2 { right: -220px; top: 10%; background: #00d3a7; animation-duration: 12s; }
        .mls-b3 { left: 15%; bottom: -240px; background: #7b61ff; animation-duration: 14s; }
        .mls-noise {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.20'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
          opacity: 0.16;
        }
        .mls-grid {
          position: absolute; inset: 0;
          background:
            linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.10;
          mask-image: radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%);
        }

        /* Content wrapper */
        .mls-content {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          min-height: 560px;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background: #0b2540;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* Header */
        .mls-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }
        .mls-brand {
          display: flex; gap: 12px; align-items: center; min-width: 0;
        }
        .mls-logo-mark {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(44,144,255,.9), rgba(0,211,167,.85));
          box-shadow: 0 10px 30px rgba(0,0,0,.25);
          flex: 0 0 auto;
        }
        .mls-brand-name {
          font-weight: 700; font-size: 18px; letter-spacing: 0.2px; line-height: 1.15;
        }
        .mls-brand-sub {
          margin-top: 2px; font-size: 12.5px; opacity: 0.85;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 46vw;
        }
        .mls-chips {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;
          animation: mls-fade-in 0.4s ease-out both;
        }
        .mls-chip {
          font-size: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.16);
          backdrop-filter: blur(8px);
          white-space: nowrap;
        }
        .mls-chip-ai {
          background: rgba(0,211,167,0.12);
          border-color: rgba(0,211,167,0.28);
        }

        /* Stage (2-col) */
        .mls-stage {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 22px;
          align-items: center;
          flex: 1;
          min-height: 0;
        }
        @media (max-width: 1280px) {
          .mls-stage { grid-template-columns: 1fr; }
          .mls-mock-wrap { display: none; }
        }

        /* Copy block */
        .mls-copy {
          animation: mls-fade-up 0.5s ease-out both;
        }
        .mls-kicker {
          font-size: 12px; letter-spacing: 0.16em;
          text-transform: uppercase; opacity: 0.8;
        }
        .mls-title {
          margin: 10px 0 8px;
          font-size: clamp(22px, 2.2vw, 32px);
          font-weight: 800;
          line-height: 1.1;
        }
        .mls-desc {
          margin: 0 0 14px;
          font-size: 14px; opacity: 0.9;
          max-width: 52ch;
        }
        .mls-bullets {
          margin: 0; padding: 0; list-style: none;
          display: grid; gap: 10px; max-width: 58ch;
        }
        .mls-bullets li {
          display: flex; gap: 10px; align-items: flex-start;
          font-size: 13.5px; line-height: 1.25; opacity: 0.92;
        }
        .mls-dot {
          width: 10px; height: 10px; margin-top: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 0 0 4px rgba(44,144,255,0.12);
          flex: 0 0 auto;
        }
        .mls-hint {
          display: inline-flex;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.14);
          font-size: 12.5px;
          opacity: 0.95;
          margin-top: 14px;
        }

        /* Mock card */
        .mls-mock-wrap {
          width: 100%; display: grid; place-items: center; min-height: 280px;
        }
        .mls-mock-card {
          width: min(420px, 100%);
          border-radius: 18px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.16);
          box-shadow: 0 18px 60px rgba(0,0,0,0.28);
          backdrop-filter: blur(10px);
          overflow: hidden;
          animation: mls-fade-in 0.5s ease-out both;
        }
        .mls-mock-top {
          display: flex; gap: 8px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.10);
        }
        .mls-pill {
          width: 54px; height: 10px; border-radius: 999px;
          background: rgba(255,255,255,0.18);
        }
        .mls-pill-sm { width: 34px; opacity: 0.85; }
        .mls-mock-body { padding: 14px; display: grid; gap: 12px; }
        .mls-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .mls-kpi {
          padding: 12px; border-radius: 14px;
          background: rgba(0,0,0,0.14);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .mls-kpi-label { font-size: 11px; opacity: 0.85; }
        .mls-kpi-value { margin-top: 6px; font-size: 16px; font-weight: 700; }
        .mls-panel {
          padding: 12px; border-radius: 14px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .mls-panel-title {
          display: flex; align-items: center; justify-content: space-between;
          font-weight: 700; font-size: 13px; margin-bottom: 10px;
        }
        .mls-ai-tag {
          font-size: 11px; padding: 4px 8px; border-radius: 999px;
          background: rgba(0,211,167,0.14);
          border: 1px solid rgba(0,211,167,0.28);
        }
        .mls-lines { display: grid; gap: 8px; margin-bottom: 12px; }
        .mls-line {
          height: 10px; border-radius: 999px;
          background: rgba(255,255,255,0.16);
        }
        .mls-btn-row { display: flex; gap: 10px; justify-content: flex-end; }
        .mls-btn-mini {
          font-size: 12px; padding: 10px 12px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.10);
          color: #eef6ff;
        }
        .mls-btn-primary {
          background: linear-gradient(135deg, rgba(44,144,255,.9), rgba(0,211,167,.85));
          border-color: rgba(255,255,255,0.18);
          font-weight: 700;
        }
        .mls-mini-grid {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
        }
        .mls-tile {
          text-align: center; padding: 10px 8px; font-size: 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.12);
          border: 1px solid rgba(255,255,255,0.12);
          opacity: 0.92; color: #eef6ff;
        }
        .mls-tile-active {
          background: rgba(0,211,167,0.14);
          border-color: rgba(0,211,167,0.26);
          box-shadow: 0 0 0 6px rgba(0,211,167,0.08);
        }

        /* Footer */
        .mls-bottom {
          display: flex; align-items: center;
          justify-content: space-between; gap: 14px;
        }
        .mls-dots { display: flex; gap: 8px; }
        .mls-dot-btn {
          width: 10px; height: 10px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.12);
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }
        .mls-dot-active {
          background: rgba(0,211,167,0.75);
          border-color: rgba(0,211,167,0.85);
          box-shadow: 0 0 0 6px rgba(0,211,167,0.12);
        }
        .mls-progress {
          flex: 1; height: 6px; border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.12);
          overflow: hidden;
        }
        .mls-bar {
          height: 100%; width: 100%;
          transform-origin: left center;
          background: linear-gradient(90deg, rgba(44,144,255,.9), rgba(0,211,167,.85));
          transform: scaleX(0);
        }

        /* Animations */
        @keyframes mls-float {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(0,28px,0) scale(1.05); }
        }
        @keyframes mls-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mls-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mls-blob { animation: none !important; }
          .mls-copy { animation: none !important; opacity: 1; }
          .mls-chips { animation: none !important; opacity: 1; }
          .mls-mock-card { animation: none !important; opacity: 1; }
          .mls-bar { transition: none !important; transform: scaleX(1) !important; }
        }
      `}</style>
    </div>
  );
}

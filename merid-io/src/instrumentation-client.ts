import { initBotId } from "botid/client/core";

/**
 * Vercel BotID – client-side initialisation (Next.js 15.3+ approach).
 *
 * Protected routes: authentication endpoints, admin actions,
 * and any other sensitive POST endpoints.
 *
 * Deep Analysis must be enabled in the Vercel Dashboard:
 *   Firewall → Bot Management → Deep Analysis toggle.
 */
initBotId({
  protect: [
    // ── Auth endpoints (unauthenticated — need BotID) ──
    { path: "/api/auth/callback/credentials", method: "POST" },
    { path: "/api/auth/forgot-password", method: "POST" },
    { path: "/api/auth/reset-password", method: "POST" },
    // 2FA endpoints removed: they require a valid session (auth()),
    // and the Deep Analysis Kasada challenge added client-side delay
    // that caused SMTP timeouts and missing 2FA emails.

    // ── Admin endpoints ──
    { path: "/api/admin/*", method: "POST" },
    { path: "/api/admin/*", method: "PATCH" },
    { path: "/api/admin/*", method: "DELETE" },

    // ── AI chat ──
    { path: "/api/chat", method: "POST" },

    // ── File uploads ──
    { path: "/api/upload", method: "POST" },
  ],
});

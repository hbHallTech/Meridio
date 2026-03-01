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
    // ── Auth endpoints ──
    { path: "/api/auth/callback/credentials", method: "POST" },
    { path: "/api/auth/forgot-password", method: "POST" },
    { path: "/api/auth/reset-password", method: "POST" },
    { path: "/api/auth/2fa/*", method: "POST" },

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

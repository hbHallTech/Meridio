import { checkBotId } from "botid/server";

/**
 * Safe wrapper around Vercel BotID's checkBotId().
 *
 * If the bot-protect API is unreachable or returns an error,
 * the request is allowed through — other defences (rate limiting,
 * authentication, brute-force protection) still apply.
 */
export async function isBotRequest(): Promise<boolean> {
  try {
    const result = await checkBotId();
    return result.isBot && !result.isVerifiedBot;
  } catch {
    // Bot protection unavailable — fail open so legitimate users
    // are never locked out of critical auth flows.
    return false;
  }
}

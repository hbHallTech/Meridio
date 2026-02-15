import { auth } from "@/lib/auth";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Server-side inactivity guard.
 * Call this at the start of any sensitive Server Action or API route.
 * Throws if the session has been inactive for more than 30 minutes.
 * Returns the validated session.
 */
export async function assertSessionActive() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Non authentifie");
  }

  // lastActivity is stored in the JWT token via the jwt callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastActivity = (session as any).lastActivity as number | undefined;

  if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
    throw new Error("SESSION_INACTIVE");
  }

  return session;
}

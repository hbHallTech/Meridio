"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { signOut } from "next-auth/react";

// ---------- Configuration ----------

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 60 * 1000; // Show warning 60s before logout

function getTimeoutMs(): number {
  const envMin = process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES;
  if (envMin) {
    const parsed = Number(envMin);
    if (!Number.isNaN(parsed) && parsed >= 1) return parsed * 60 * 1000;
  }
  return DEFAULT_TIMEOUT_MS;
}

// ---------- Multi-tab sync via localStorage ----------

const LS_KEY = "meridio_last_activity";

function broadcastActivity() {
  try {
    localStorage.setItem(LS_KEY, Date.now().toString());
  } catch {
    // Private browsing or quota — ignore
  }
}

// ---------- Activity events ----------

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "scroll",
  "click",
  "touchstart",
] as const;

// ---------- Hook ----------

export interface UseInactivityState {
  /** true when the warning countdown is active (last 60s before logout) */
  showWarning: boolean;
  /** seconds remaining before auto-logout (only meaningful when showWarning=true) */
  secondsLeft: number;
  /** call this to dismiss the warning and reset the full timer */
  stayActive: () => void;
}

export function useInactivity(): UseInactivityState {
  const timeoutMs = getTimeoutMs();
  const warningAtMs = Math.max(timeoutMs - WARNING_BEFORE_MS, 0);

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_BEFORE_MS / 1000));

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutDeadlineRef = useRef<number>(0);

  // ----- Logout -----
  const doLogout = useCallback(() => {
    console.warn("[idle-timeout] Auto-logout due to inactivity");
    signOut({ callbackUrl: "/login?reason=inactivity" });
  }, []);

  // ----- Start warning countdown -----
  const startWarning = useCallback(() => {
    setShowWarning(true);
    logoutDeadlineRef.current = Date.now() + WARNING_BEFORE_MS;
    setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));

    // Tick every second
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, logoutDeadlineRef.current - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }, 1000);

    // Hard logout
    logoutTimerRef.current = setTimeout(doLogout, WARNING_BEFORE_MS);
  }, [doLogout]);

  // ----- Clear all timers -----
  const clearAll = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  // ----- Reset full cycle -----
  const resetTimer = useCallback(() => {
    clearAll();
    setShowWarning(false);
    setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));
    warningTimerRef.current = setTimeout(startWarning, warningAtMs);
  }, [clearAll, startWarning, warningAtMs]);

  // ----- Activity handler (throttled to 2s) -----
  const lastActivityRef = useRef<number>(0);
  const onActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < 2000) return; // throttle
    lastActivityRef.current = now;
    broadcastActivity();
    // Only reset if warning is NOT showing — once warning is visible, user must click "Stay"
    if (!logoutTimerRef.current || !countdownRef.current) {
      resetTimer();
    }
  }, [resetTimer]);

  // ----- Public: user clicks "Stay active" -----
  const stayActive = useCallback(() => {
    broadcastActivity();
    resetTimer();
  }, [resetTimer]);

  // ----- Mount -----
  useEffect(() => {
    // Start idle cycle
    resetTimer();

    // DOM activity listeners
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    // Visibility change: if tab comes back to foreground, check elapsed time
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Check if we should already be logged out
        const lastStr = localStorage.getItem(LS_KEY);
        const lastActivity = lastStr ? Number(lastStr) : Date.now();
        const elapsed = Date.now() - lastActivity;

        if (elapsed >= getTimeoutMs()) {
          doLogout();
        } else if (elapsed >= getTimeoutMs() - WARNING_BEFORE_MS) {
          // Should be in warning phase
          clearAll();
          const remaining = getTimeoutMs() - elapsed;
          setShowWarning(true);
          logoutDeadlineRef.current = Date.now() + remaining;
          setSecondsLeft(Math.ceil(remaining / 1000));
          countdownRef.current = setInterval(() => {
            const r = Math.max(0, logoutDeadlineRef.current - Date.now());
            setSecondsLeft(Math.ceil(r / 1000));
            if (r <= 0 && countdownRef.current) clearInterval(countdownRef.current);
          }, 1000);
          logoutTimerRef.current = setTimeout(doLogout, remaining);
        } else {
          onActivity();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Multi-tab sync: another tab broadcasted activity
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) {
        // Another tab is active → reset our timer too
        resetTimer();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearAll();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { showWarning, secondsLeft, stayActive };
}

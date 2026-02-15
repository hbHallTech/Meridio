"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;

interface UseInactivityOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
}

/**
 * Hook that signs the user out after a period of inactivity.
 * Tracks mousemove, keydown, scroll, click, and touchstart events.
 */
export function useInactivity(options: UseInactivityOptions = {}) {
  const { timeoutMs = INACTIVITY_TIMEOUT_MS, onTimeout } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(() => {
    if (onTimeout) {
      onTimeout();
    }
    signOut({ callbackUrl: "/login?reason=inactivity" });
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs]);

  useEffect(() => {
    // Start the timer
    resetTimer();

    // Listen for activity events
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}

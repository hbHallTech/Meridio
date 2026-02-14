"use client";

import useSWR from "swr";
import { useCallback } from "react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  data: Record<string, unknown> | null;
  link: string | null;
  isRead: boolean;
  sentByEmail: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useNotifications(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    `/api/notifications?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30s
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      mutate();
    },
    [mutate]
  );

  const markAllAsRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    mutate();
  }, [mutate]);

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isError: !!error,
    markAsRead,
    markAllAsRead,
    refresh: mutate,
  };
}

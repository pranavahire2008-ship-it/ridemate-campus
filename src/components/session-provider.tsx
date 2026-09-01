"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NotificationItem, PublicUserDTO } from "@/lib/types";

type SessionContextValue = {
  user: PublicUserDTO | null;
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  paymentMode: "razorpay";
  refresh: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  logout: () => Promise<void>;
  markAllRead: () => Promise<void>;
  requireAuth: () => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUserDTO | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<"razorpay">("razorpay");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as {
        user: PublicUserDTO | null;
        notifications?: NotificationItem[];
        paymentMode?: "razorpay";
      };
      setUser(data.user ?? null);
      setNotifications(data.notifications ?? []);
      if (data.paymentMode) setPaymentMode(data.paymentMode);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the notification bell fresh without a heavy polling loop.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch("/api/notifications", { cache: "no-store" });
          const data = (await res.json()) as { notifications?: NotificationItem[] };
          if (data.notifications) setNotifications(data.notifications);
        } catch {
          /* ignore transient errors */
        }
      })();
    }, 25000);
    return () => clearInterval(interval);
  }, [user]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setNotifications([]);
  }, []);

  const markAllRead = useCallback(async () => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { notifications?: NotificationItem[] };
    if (data.notifications) setNotifications(data.notifications);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      notifications,
      unreadCount,
      loading,
      paymentMode,
      refresh,
      refreshNotifications: markAllRead,
      logout,
      markAllRead,
      requireAuth: () => Boolean(user),
    }),
    [user, notifications, unreadCount, loading, paymentMode, refresh, markAllRead, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

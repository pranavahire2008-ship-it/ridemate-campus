"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Badge } from "@/components/ui";
import { useSession } from "@/components/session-provider";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-mint-500 shadow-[0_6px_16px_-6px_rgba(36,81,230,0.8)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="6" cy="17" r="2.6" />
          <circle cx="18" cy="17" r="2.6" />
          <path d="M8.6 17h6.8M6 14.4V7.2A2.2 2.2 0 0 1 8.2 5h5.4l3.6 3.4v6" />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[19px] font-extrabold tracking-tight text-slate-900">
          Ride<span className="text-brand-600">Mate</span>
          <span className="ml-1 hidden align-middle text-[10px] font-bold uppercase tracking-[0.18em] text-mint-600 sm:inline">
            Campus
          </span>
        </span>
      ) : null}
    </Link>
  );
}

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/find", label: "Find a Ride" },
  { href: "/offer", label: "Offer a Ride" },
  { href: "/rides", label: "My Rides" },
  { href: "/safety", label: "Safety" },
  { href: "/profile", label: "Profile" },
];

const ICONS: Record<string, string> = {
  "/": "🏠",
  "/find": "🔍",
  "/offer": "➕",
  "/rides": "📋",
  "/profile": "👤",
};

function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useSession();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          if (!open && unreadCount > 0) void markAllRead();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-12 z-50 w-[min(88vw,22rem)] animate-[slide-in_0.22s_ease-out] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lift"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <Badge tone="brand">{notifications.length} total</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet. Book a ride to get started.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(n.rideId ? `/rides/${n.rideId}` : "/rides");
                  }}
                  className="flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="mt-0.5 text-lg">
                    {n.type === "booking_request"
                      ? "📩"
                      : n.type === "booking_accepted"
                        ? "🎉"
                        : n.type === "booking_rejected"
                          ? "❌"
                          : n.type === "ride_cancelled"
                            ? "🚫"
                            : n.type === "ride_reminder"
                              ? "⏰"
                              : n.type === "route_match"
                                ? "🧭"
                                : n.type === "new_review"
                                  ? "⭐"
                                  : "🔔"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-slate-900">{n.title}</span>
                      {!n.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{n.body}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="hidden h-10 items-center rounded-xl px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(36,81,230,0.7)] transition hover:bg-brand-700"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition hover:border-slate-300"
      >
        <Avatar name={user.fullName} color={user.avatarColor} size="sm" verified={user.verified} />
        <span className="hidden max-w-24 truncate text-sm font-semibold text-slate-800 sm:block">
          {user.fullName.split(" ")[0]}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-12 z-50 w-56 animate-[slide-in_0.22s_ease-out] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lift"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user.college || "Student"}</p>
          </div>
          {[
            { href: "/profile", label: "My Profile", icon: "👤" },
            { href: "/verification", label: "Verification", icon: "🛡" },
            { href: "/rides", label: "My Rides", icon: "📋" },
            { href: "/earnings", label: "Driver Earnings", icon: "💰" },
            { href: "/offer", label: "Offer a Ride", icon: "➕" },
            { href: "/safety", label: "Safety Centre", icon: "🔒" },
            ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin Console", icon: "🛠" }] : []),
          ].map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(item.href);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/");
              router.refresh();
            }}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <span>↩</span> Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {user ? <NotificationBell /> : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { user, unreadCount } = useSession();
  const items = [
    { href: "/", label: "Home" },
    { href: "/find", label: "Find" },
    { href: "/offer", label: "Offer Ride", primary: true },
    { href: "/rides", label: "My Rides", badge: unreadCount },
    { href: user ? "/profile" : "/login", label: "Profile" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-end justify-between px-3 pt-2">
        {items.map((item) => {
          const active = pathname === item.href;
          if (item.primary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-6 flex flex-col items-center gap-1 active:scale-95"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-mint-500 text-2xl font-light text-white shadow-[0_10px_24px_-10px_rgba(36,81,230,0.9)]">
                  +
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Offer</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex w-16 flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                active ? "text-brand-700" : "text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">{ICONS[item.href] ?? "•"}</span>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
              {active ? <span className="h-1 w-6 rounded-full bg-brand-600" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

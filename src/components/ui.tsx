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
import { avatarGradient, initials } from "@/lib/locations";

/* ------------------------------- Toasts ------------------------------- */

type Toast = { id: number; title: string; body?: string; tone: "success" | "error" | "info" };
type ToastContextValue = { push: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:top-20 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm animate-[pop_0.22s_ease-out] rounded-2xl border px-4 py-3 shadow-lift backdrop-blur ${
              t.tone === "success"
                ? "border-mint-200 bg-white/95"
                : t.tone === "error"
                  ? "border-rose-200 bg-white/95"
                  : "border-slate-200 bg-white/95"
            }`}
          >
            <div className="flex gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                  t.tone === "success"
                    ? "bg-mint-100 text-mint-700"
                    : t.tone === "error"
                      ? "bg-rose-100 text-rose-600"
                      : "bg-brand-50 text-brand-700"
                }`}
              >
                {t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.body}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------- Avatar ------------------------------- */

export function Avatar({
  name,
  color = "blue",
  size = "md",
  verified = false,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  verified?: boolean;
}) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
    xl: "h-24 w-24 text-2xl",
  } as const;
  return (
    <span className="relative inline-block shrink-0">
      <span
        className={`flex items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-card ${avatarGradient(
          color,
        )} ${sizes[size]}`}
      >
        {initials(name) || "S"}
      </span>
      {verified ? (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-mint-500 text-[10px] font-bold text-white">
          ✓
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------- Badge -------------------------------- */

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "mint" | "amber" | "rose";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    brand: "bg-brand-50 text-brand-700",
    mint: "bg-mint-50 text-mint-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-600",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
      <span className="text-amber-500">
        {"★".repeat(Math.round(Math.max(0, Math.min(5, rating))))}
        <span className="text-slate-300">{"★".repeat(5 - Math.round(Math.max(0, Math.min(5, rating))))}</span>
      </span>
      {rating > 0 ? (
        <span>
          {rating.toFixed(1)}
          {typeof count === "number" ? <span className="font-normal text-slate-400"> ({count})</span> : null}
        </span>
      ) : (
        <span className="font-normal text-slate-400">New student</span>
      )}
    </span>
  );
}

/* ------------------------------- Buttons ------------------------------ */

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "md",
  full,
  loading,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_20px_-8px_rgba(36,81,230,0.7)]",
    secondary: "bg-white text-slate-800 border border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    success: "bg-mint-600 text-white hover:bg-mint-700 shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)]",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100",
  } as const;
  const sizes = {
    sm: "h-9 px-3.5 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-6 text-base",
  } as const;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

/* ------------------------------- Fields ------------------------------- */

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputClass} cursor-pointer pr-9 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} resize-none ${props.className ?? ""}`} />;
}

/* --------------------------- Segmented control ------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-col items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] ${
              size === "md" ? "px-3 py-3" : "px-3 py-2"
            } ${
              active
                ? "bg-white shadow-card ring-1 ring-slate-900/5"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span
              className={`text-sm font-semibold leading-tight ${active ? "text-slate-900" : ""}`}
            >
              {option.label}
            </span>
            {option.sub ? (
              <span
                className={`mt-0.5 text-[11px] leading-tight ${active ? "text-brand-600" : "text-slate-400"}`}
              >
                {option.sub}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Match ring ---------------------------- */

export function MatchRing({ score, size = 52 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 80 ? "#059669" : score >= 60 ? "#2451e6" : "#f59e0b";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.26}
        fontWeight="700"
        fill="#0f172a"
      >
        {score}%
      </text>
    </svg>
  );
}

/* ------------------------------ Empty state --------------------------- */

export function EmptyState({
  icon = "🧭",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- Spinner ------------------------------ */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm font-semibold text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label ?? "Loading…"}
    </div>
  );
}

/* -------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 max-h-[92vh] w-full animate-[slide-in_0.28s_cubic-bezier(0.22,1,0.36,1)] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

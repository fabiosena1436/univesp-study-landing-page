"use client";

import {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  useEffect,
  useState,
  useCallback,
} from "react";

/* ------------------------------- spinner ------------------------------- */

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="carregando"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------- button -------------------------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brand" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none active:translate-y-px select-none cursor-pointer whitespace-nowrap";
  const sizes = {
    sm: "text-sm px-3 h-9",
    md: "text-sm px-4 h-11",
    lg: "text-base px-6 h-12",
  };
  const variants = {
    primary: "bg-pen text-white hover:bg-brand-deep shadow-sm shadow-pen/20",
    brand: "bg-brand text-ink hover:bg-brand-deep hover:text-white shadow-sm",
    ghost: "bg-transparent border border-line-strong text-ink hover:bg-surface",
    danger: "bg-red-soft text-red border border-red/25 hover:bg-red hover:text-white",
    soft: "bg-pen-soft text-pen hover:bg-pen/10",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

/* ------------------------------- inputs -------------------------------- */

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full h-11 px-3.5 rounded-xl border border-line bg-card text-sm text-ink placeholder:text-muted/70 focus:border-pen focus:outline-none focus:ring-2 focus:ring-pen/10 transition ${className}`}
      {...props}
    />
  );
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3.5 py-2.5 rounded-xl border border-line bg-card text-sm text-ink placeholder:text-muted/70 focus:border-pen focus:outline-none focus:ring-2 focus:ring-pen/10 transition resize-y leading-relaxed ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full h-11 px-3 rounded-xl border border-line bg-card text-sm text-ink focus:border-pen focus:outline-none focus:ring-2 focus:ring-pen/10 transition cursor-pointer ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

/* ------------------------------- badge --------------------------------- */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "red" | "amber" | "brand" | "pen";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-ink/5 text-ink-soft",
    green: "bg-green-soft text-green",
    red: "bg-red-soft text-red",
    amber: "bg-brand-soft text-[#8a6d00]",
    brand: "bg-brand text-ink",
    pen: "bg-pen-soft text-pen",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ------------------------------- score ring ---------------------------- */

export function ScoreRing({
  pct,
  size = 150,
  stroke = 12,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const [off, setOff] = useState(c);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOff(c - (c * clamped) / 100));
    return () => cancelAnimationFrame(t);
  }, [clamped, c]);
  const color =
    pct >= 70 ? "var(--color-green)" : pct >= 40 ? "var(--color-brand-deep)" : "var(--color-red)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ------------------------------- toggle -------------------------------- */

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-line-strong transition-colors cursor-pointer"
    >
      <span
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? "bg-green" : "bg-ink/20"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

/* ------------------------------- empty state --------------------------- */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center anim-fade-up">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-brand border border-ink/10 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1.5 max-w-sm mx-auto leading-relaxed">{desc}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------- toasts -------------------------------- */

export type ToastItem = { id: number; msg: string; tone: "ok" | "err" };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const view = (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] space-y-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-pop rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${
            t.tone === "ok" ? "bg-ink text-paper" : "bg-red text-white"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { push, view };
}

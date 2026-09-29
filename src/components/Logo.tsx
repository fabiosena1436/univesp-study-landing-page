import Link from "next/link";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M25.5 12.5A10 10 0 1 0 27 17"
        stroke="var(--color-ink)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M27 8.5 27 14 21.5 14" stroke="var(--color-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12.4" y="12.4" width="7.2" height="7.2" rx="2" fill="var(--color-brand)" stroke="var(--color-ink)" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({ to = "/", dark = false }: { to?: string; dark?: boolean }) {
  return (
    <Link href={to} className="flex items-center gap-2 group">
      <LogoMark />
      <span
        className={`font-display text-xl font-bold tracking-tight group-hover:opacity-80 transition-opacity ${
          dark ? "text-paper" : "text-ink"
        }`}
      >
        Aprova UNIVESP
      </span>
    </Link>
  );
}

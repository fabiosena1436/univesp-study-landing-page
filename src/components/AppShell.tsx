"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardPaste,
  FileText,
  LibraryBig,
  History,
  LogOut,
  BookMarked,
  ShieldCheck,
  MessageSquare,
  UserCircle,
  BrainCircuit,
  Layers3,
} from "lucide-react";
import { api, clearQuizDrafts } from "@/lib/api";
import type { Subject, User } from "@/lib/types";
import { Logo } from "./Logo";
import { Spinner } from "./ui";

type Ctx = {
  user: User;
  subjects: Subject[];
  refreshSubjects: () => void;
  updateUser: (user: User) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp deve ser usado dentro de AppShell");
  return c;
}

const NAV = [
  { href: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/app/plano", label: "Meu plano", icon: BrainCircuit, exact: false },
  { href: "/app/flashcards", label: "Flashcards", icon: Layers3, exact: false },
  { href: "/app/importar", label: "Importar questões", icon: ClipboardPaste, exact: false },
  { href: "/app/materiais", label: "Materiais (PDF)", icon: BookMarked, exact: false },
  { href: "/app/prova", label: "Nova prova", icon: FileText, exact: false },
  { href: "/app/questoes", label: "Banco de questões", icon: LibraryBig, exact: false },
  { href: "/app/historico", label: "Histórico", icon: History, exact: false },
];

export default function AppShell({ children, initialUser }: { children: ReactNode; initialUser: User }) {
  const [user, setUser] = useState<User>(initialUser);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const toastShell = useToastsShell();

  const refreshSubjects = useCallback(() => {
    api<Subject[]>("/api/subjects")
      .then(setSubjects)
      .catch(() => toast("Não foi possível carregar as matérias. Atualize a página para tentar novamente.", "err"));
  }, []);

  useEffect(() => {
    refreshSubjects();
    const onRefresh = () => refreshSubjects();
    window.addEventListener("repete:subjects", onRefresh);
    return () => window.removeEventListener("repete:subjects", onRefresh);
  }, [refreshSubjects]);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-3 text-muted">
          <Spinner size={22} />
          <span className="text-sm font-semibold">Abrindo o caderno…</span>
        </div>
      </div>
    );
  }

  const initial = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const visibleNav = user.isAdmin ? NAV : NAV.filter((n) => n.href !== "/app/importar" && n.href !== "/app/materiais");
  const navLinks = (
    <>
      {visibleNav.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold ${
              active ? "nav-link-active" : ""
            }`}
          >
            <n.icon size={17} />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <AppContext.Provider value={{ user, subjects, refreshSubjects, updateUser: setUser }}>
      <div className="min-h-screen app-shell-bg">
        <header className="app-header sticky top-0 z-40 border-b backdrop-blur-xl">
          <div className="max-w-[1480px] mx-auto px-4 md:px-8 h-[72px] flex items-center gap-5">
            <Logo to="/app" dark />
            <Link href="/app/perfil" className="hidden sm:flex items-center gap-2 text-sm text-white/70 hover:text-white"><UserCircle size={17} /> Perfil</Link>
            <div className="hidden lg:block h-7 w-px bg-white/20" />
            <p className="hidden lg:block text-sm font-medium text-white/60">Seu espaço de estudos</p>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:block text-sm text-white/65 max-w-40 truncate">
                {user.name}
              </span>
              <span className="w-9 h-9 rounded-full bg-brand text-ink border border-white/20 grid place-items-center text-xs font-bold">
                {initial || "R"}
              </span>
              <button
                onClick={() =>
                  api("/api/auth/logout", { method: "POST" }).then(() => { clearQuizDrafts(); router.replace("/entrar"); router.refresh(); }).catch(() => toast("Não foi possível sair. Tente novamente.", "err"))
              }
                title="Sair"
                className="p-2 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
          <nav className="lg:hidden overflow-x-auto px-4 pb-3 flex gap-1.5">
            {visibleNav.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    active
                    ? "mobile-nav-link-active"
                    : "bg-header-soft border-white/10 text-white/70"
                  }`}
                >
                  <n.icon size={13} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          {user.isAdmin && (
            <Link href="/app/admin" className={`mt-3 nav-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold ${pathname.startsWith("/app/admin") ? "nav-link-active" : ""}`}>
              <ShieldCheck size={17} /> Administração
            </Link>
          )}
          {!user.isAdmin && (
            <Link href="/app/contato" className="mt-3 nav-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold">
              <MessageSquare size={17} /> Falar com admin
            </Link>
          )}
        </header>

        <div className="max-w-[1480px] mx-auto px-4 md:px-8 py-8 flex gap-8 items-start">
          <aside className="app-sidebar hidden lg:block w-60 shrink-0 sticky top-24">
            <nav className="space-y-1">{navLinks}</nav>
            <div className="mt-8 border-t border-line pt-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted px-3 pb-3">
              Suas matérias
            </p>
            <ul className="space-y-0.5">
              {subjects.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/app/questoes?m=${s.id}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-card text-sm transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-ink/10"
                      style={{ background: s.color }}
                    />
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="ml-auto text-xs text-muted tabular-nums">
                      {s.questionCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {subjects.length === 0 && (
              <p className="text-xs text-muted px-3 leading-relaxed">
                {user.isAdmin ? (
                  <>
                    Nenhuma matéria ainda.{" "}
                    <Link href="/app/importar" className="text-pen font-semibold hover:underline">
                      Importe questões
                    </Link>{" "}
                    para criar a primeira.
                  </>
                ) : (
                  "Nenhuma matéria publicada ainda."
                )}
              </p>
            )}
            </div>
          </aside>
          <main className="flex-1 min-w-0 w-full">{children}</main>
        </div>
      </div>
      {toastShell}
    </AppContext.Provider>
  );
}

/* toasts globais via evento de janela (qualquer página pode disparar) */
function useToastsShell() {
  const [items, setItems] = useState<{ id: number; msg: string; tone: "ok" | "err" }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { msg: string; tone?: "ok" | "err" } | undefined;
      if (!d?.msg) return;
      const id = Date.now() + Math.random();
      setItems((t) => [...t, { id, msg: d.msg, tone: d.tone ?? "ok" }]);
      setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4200);
    };
    window.addEventListener("repete:toast", on);
    return () => window.removeEventListener("repete:toast", on);
  }, []);
  return (
    <div aria-live="polite" aria-atomic="false" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] space-y-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {items.map((t) => (
        <div
          role={t.tone === "err" ? "alert" : "status"}
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
}

export function toast(msg: string, tone: "ok" | "err" = "ok") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("repete:toast", { detail: { msg, tone } }));
  }
}

export function refreshSubjectsEvent() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("repete:subjects"));
}

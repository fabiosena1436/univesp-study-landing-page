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
import { MotionConfig } from "motion/react";
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
import { StudyAssistant } from "./StudyAssistant";
import { Spinner } from "./ui";
import { tutorPageFromPath, type TutorScope } from "@/lib/tutorScope";
import { CommunityInbox, type InboxSummary } from "./CommunityInbox";
import { ActivityTracker } from "./ActivityTracker";
import { UserNotifications } from "./UserNotifications";
import { AdminNotifications } from "./AdminNotifications";

type AssistantScope = { scope: TutorScope; subjectName: string };

type Ctx = {
  user: User;
  subjects: Subject[];
  refreshSubjects: () => void;
  updateUser: (user: User) => void;
  setAssistantScope: (scope: AssistantScope | null) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp deve ser usado dentro de AppShell");
  return c;
}

export function useStudyAssistantScope(value: AssistantScope | null) {
  const { setAssistantScope } = useApp();
  const page = tutorPageFromPath(usePathname());
  const subjectId = value?.scope.subjectId;
  const materialId = value?.scope.materialId;
  const questionId = value?.scope.questionId;
  const subjectName = value?.subjectName;
  useEffect(() => {
    setAssistantScope(subjectId && subjectName ? { scope: { subjectId, materialId, questionId, page }, subjectName } : null);
    return () => setAssistantScope(null);
  }, [setAssistantScope, subjectId, materialId, questionId, subjectName, page]);
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
  const [assistantScope, setAssistantScope] = useState<AssistantScope | null>(null);
  const [assistantSubjectId, setAssistantSubjectId] = useState("");
  const [inbox, setInbox] = useState<InboxSummary>({ unread: 0, fresh: 0 });
  const router = useRouter();
  const pathname = usePathname();
  const toastShell = useToastsShell();

  useEffect(() => {
    const expire = () => { clearQuizDrafts(); router.replace("/entrar"); router.refresh(); };
    window.addEventListener("repete:unauthorized", expire);
    return () => window.removeEventListener("repete:unauthorized", expire);
  }, [router]);

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

  const visibleNav = (user.isAdmin || user.isAssistant) ? NAV : NAV.filter((n) => !["/app/importar", "/app/questoes"].includes(n.href));
  const assistantSubject = subjects.find(subject => subject.id === assistantSubjectId) ?? subjects[0];
  const assistantPage = tutorPageFromPath(pathname);
  const pageScope = assistantScope?.scope.page === assistantPage ? assistantScope : null;
  const currentAssistantScope: TutorScope = pageScope?.scope ?? { subjectId: assistantSubject?.id, page: assistantPage };
  const currentAssistantSubjectName = pageScope?.subjectName ?? assistantSubject?.name ?? "a plataforma";
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
    <MotionConfig reducedMotion="user"><AppContext.Provider value={{ user, subjects, refreshSubjects, updateUser: setUser, setAssistantScope }}>
      <div className="min-h-screen app-shell-bg">
        <header className="app-header sticky top-0 z-40 border-b">
          <div className="max-w-[1480px] mx-auto px-4 md:px-8 h-16 sm:h-[72px] flex items-center gap-2 sm:gap-5">
            <Logo to="/app" dark compact />
            <Link href="/app/perfil" className="hidden lg:flex items-center gap-2 text-sm text-white/70 hover:text-white"><UserCircle size={17} /> Perfil</Link>
            <div className="hidden lg:block h-7 w-px bg-white/20" />
            <p className="hidden lg:block text-sm font-medium text-white/60">Seu espaço de estudos</p>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
              <StudyAssistant key={`${assistantPage}:${currentAssistantScope.subjectId ?? ""}:${currentAssistantScope.materialId ?? ""}:${currentAssistantScope.questionId ?? ""}`} scope={currentAssistantScope} subjectName={currentAssistantSubjectName} subjects={pageScope ? undefined : subjects} selectedSubjectId={assistantSubject?.id ?? ""} onSubjectChange={setAssistantSubjectId} />
              {user.isAdmin && <AdminNotifications key={user.id} userId={user.id} />}
              {!user.isAdmin && <UserNotifications key={user.id} summary={inbox} userId={user.id} />}
              <span className="hidden lg:block text-sm text-white/65 max-w-40 truncate">
                {user.name}
              </span>
              <span className="hidden sm:grid w-9 h-9 rounded-full bg-brand text-ink border border-white/20 place-items-center text-xs font-bold">
                {initial || "R"}
              </span>
              <button
                onClick={() =>
                  api("/api/auth/logout", { method: "POST" }).then(() => { clearQuizDrafts(); router.replace("/entrar"); router.refresh(); }).catch(() => toast("Não foi possível sair. Tente novamente.", "err"))
              }
                title="Sair"
                className="p-3 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
          {user.isAdmin && (
            <Link href="/app/admin" className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${pathname.startsWith("/app/admin") ? "mobile-nav-link-active" : "bg-header-soft border-white/10 text-white/70"}`}>
              <ShieldCheck size={17} /> Administração
            </Link>
          )}
          {!user.isAdmin && (
            <Link href="/app/contato" className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 text-white/70">
              <MessageSquare size={17} /> Falar com admin
            </Link>
          )}
          </nav>
        </header>

        <div className="max-w-[1480px] mx-auto px-4 md:px-8 py-8 flex gap-8 items-start">
          <aside className="app-sidebar hidden lg:block w-60 shrink-0 sticky top-24">
            <nav className="space-y-1">{navLinks}<Link href={user.isAdmin ? "/app/admin" : "/app/contato"} className={`nav-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold ${pathname === (user.isAdmin ? "/app/admin" : "/app/contato") ? "nav-link-active" : ""}`}>{user.isAdmin ? <ShieldCheck size={17} /> : <MessageSquare size={17} />}{user.isAdmin ? "Administração" : "Falar com admin"}</Link></nav>
            <div className="mt-8 border-t border-line pt-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted px-3 pb-3">
              Suas matérias
            </p>
            <ul className="space-y-0.5">
              {subjects.map((s) => (
                <li key={s.id}>
                  <Link
                    href={(user.isAdmin || user.isAssistant) ? `/app/questoes?m=${s.id}` : `/app/prova?m=${s.id}`}
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
                {(user.isAdmin || user.isAssistant) ? (
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
          <main className="flex-1 min-w-0 w-full pb-24"><CommunityInbox key={user.id} admin={Boolean(user.isAdmin)} onSummary={setInbox} />{children}</main>
        </div>
      </div>

      {toastShell}
      <ActivityTracker />
    </AppContext.Provider></MotionConfig>
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

import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, Wallet, Zap } from "lucide-react";
import { Logo } from "./Logo";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* painel institucional */}
      <div className="hidden lg:flex flex-col justify-between bg-ink text-paper p-12 relative overflow-hidden">
        <div className="dots absolute inset-0 opacity-[0.08] pointer-events-none" />
        <div className="relative">
          <Logo to="/" dark />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.08]">
            Sua revisão vira{" "}
            <span className="marker-soft">prova</span>
            <span>.</span>
          </h2>
          <p className="mt-5 text-paper/70 leading-relaxed">
            Pratique com questões publicadas pelos administradores, faça simulados
            e use flashcards para revisar o conteúdo. Seu progresso fica no seu histórico.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              { icon: Zap, t: "Treinos com gabarito e feedback disponível" },
              { icon: ShieldCheck, t: "Catálogo compartilhado e histórico individual" },
              { icon: Wallet, t: "Acesso gratuito com cadastro e senha" },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-3 text-sm text-paper/85">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-paper/10 grid place-items-center text-brand">
                  <f.icon size={15} />
                </span>
                {f.t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-paper/40">
          <CheckCircle2 size={14} />
          Feito por estudante, para estudantes.
        </div>
      </div>

      {/* formulário */}
      <div className="flex items-center justify-center p-6 md:p-10 dots">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo to="/" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Database,
  KeyRound,
  RotateCcw,
  Sparkles,
  Target,
  BarChart3,
  ShieldCheck,
  UploadCloud,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const STEPS = [
  {
    icon: ClipboardPaste,
    title: "Cole a revisão",
    desc: "Copie o texto direto da área de revisão da plataforma da faculdade — com alternativas, feedback e tudo — e jogue aqui.",
  },
  {
    icon: Sparkles,
    title: "A gente organiza",
    desc: "O motor de análise separa enunciado, alternativas, gabarito e explicação de cada questão. Você só confere e salva no banco.",
  },
  {
    icon: Target,
    title: "Gere a prova",
    desc: "Escolheu a matéria, definiu quantas questões e pronto: prova na tela, correção na hora e revisão do que você errou.",
  },
];

const FEATURES = [
  {
    icon: Database,
    title: "Banco por matéria",
    desc: "Cada disciplina tem o seu cofre de questões, com busca e organização por cor.",
  },
  {
    icon: KeyRound,
    title: "Gabarito automático",
    desc: "A alternativa certa é detectada a partir do feedback da própria revisão, sem você caçar letra.",
  },
  {
    icon: RotateCcw,
    title: "Revisão de erros",
    desc: "O site anota o que você erra e monta uma prova só com as questões que ainda te pegam.",
  },
  {
    icon: CheckCircle2,
    title: "Explicação em cada questão",
    desc: "Acertou ou errou, você lê o porquê de cada alternativa antes de avançar.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* header */}
      <header className="app-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Logo dark />
          <nav className="flex items-center gap-2">
            <Link
              href="/entrar"
              className="px-4 h-10 inline-flex items-center text-sm font-semibold rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="px-4 h-10 inline-flex items-center text-sm font-semibold rounded-xl bg-brand text-ink hover:bg-brand-deep hover:text-white transition-colors"
            >
              Criar conta grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden bg-header text-white">
        <div className="absolute inset-0 opacity-20 dots" />
        <div className="absolute -right-40 -top-40 w-[34rem] h-[34rem] rounded-full bg-brand-deep/30 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28 grid lg:grid-cols-[1.02fr_0.98fr] gap-14 items-center">
          <div className="anim-fade-up">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand bg-white/10 border border-white/15 rounded-full px-3 py-1.5">
              <Sparkles size={13} /> Grátis para o grupo da faculdade
            </p>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-semibold leading-[1.02] tracking-tight">
              Estude melhor.
              <br />
              <span className="text-brand">Passe na prova.</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-lg">
              Transforme qualquer revisão em um banco de questões inteligente. Importe,
              pratique e acompanhe sua evolução em um só lugar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cadastro"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-brand text-ink font-bold hover:bg-brand-deep hover:text-white transition-colors"
              >
                Começar gratuitamente <ArrowRight size={17} />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-white/20 bg-white/10 font-semibold text-white hover:bg-white/15 transition-colors"
              >
                Como funciona
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/55">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} /> Sem cartão</span>
              <span className="inline-flex items-center gap-1.5"><Zap size={15} /> Resultado rápido</span>
              <span className="inline-flex items-center gap-1.5"><UploadCloud size={15} /> Importe em segundos</span>
            </div>
          </div>

          <div className="relative anim-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-5 rounded-[2rem] bg-brand/10 blur-2xl" />
            <div className="relative rounded-3xl bg-white p-4 md:p-5 shadow-2xl shadow-black/25">
              <div className="rounded-2xl bg-surface border border-line p-4">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-pen text-white grid place-items-center"><BarChart3 size={16} /></span>
                    <div><p className="text-xs text-muted">Painel de desempenho</p><p className="font-bold text-ink">Visão geral</p></div>
                  </div>
                  <span className="text-xs font-bold text-green bg-green-soft rounded-full px-2.5 py-1">+18% este mês</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    ["48", "Questões"],
                    ["82%", "Média"],
                    ["6", "Provas"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl bg-white border border-line p-3">
                      <p className="font-display text-xl font-bold text-ink">{value}</p>
                      <p className="text-[11px] text-muted mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-white border border-line p-3">
                  <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold text-ink">Evolução nas provas</p><p className="text-[11px] text-muted">Últimas 6</p></div>
                  <div className="h-24 flex items-end gap-2 px-2">
                    {[38, 48, 44, 62, 70, 82].map((height, index) => (
                      <div key={index} className="flex-1 rounded-t-md bg-pen/15 relative" style={{ height: `${height}%` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-pen" style={{ height: `${Math.min(100, height + 12)}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white border border-line shadow-xl px-4 py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-green-soft text-green grid place-items-center"><CheckCircle2 size={18} /></span>
                <div><p className="text-xs font-bold text-ink">Prova corrigida</p><p className="text-[11px] text-muted">Você acertou 8 de 10</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* como funciona */}
      <section id="como-funciona" className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <p className="text-xs uppercase tracking-[0.2em] text-pen font-bold">Do texto à aprovação</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight">Três passos para estudar com mais intenção</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card p-6 relative border-t-4 border-t-pen">
                <span className="text-xs font-bold text-pen">0{i + 1}</span>
                <span className="mt-4 inline-grid place-items-center w-11 h-11 rounded-xl bg-pen-soft text-pen mb-4">
                  <s.icon size={20} />
                </span>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4 card p-5">
              <span className="shrink-0 w-10 h-10 rounded-xl bg-pen-soft text-pen grid place-items-center">
                <f.icon size={18} />
              </span>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto rounded-3xl bg-ink text-paper px-6 py-14 md:py-16 text-center relative overflow-hidden">
          <div className="dots absolute inset-0 opacity-[0.08] pointer-events-none" />
          <h2 className="relative font-display text-3xl md:text-5xl font-semibold tracking-tight">
            Bora passar de <span className="marker-soft text-ink">primeira</span>?
          </h2>
          <p className="relative mt-4 text-paper/70 max-w-md mx-auto">
            Crie a conta em 20 segundos e importe a primeira matéria da faculdade agora.
          </p>
          <Link
            href="/cadastro"
            className="relative mt-8 inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-brand text-ink font-bold hover:brightness-95 transition-all"
          >
            Começar grátis <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between text-sm text-muted">
          <Logo />
          <p>Feito com carinho para o grupo da faculdade.</p>
        </div>
      </footer>
    </div>
  );
}

"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="max-w-xl mx-auto p-8 space-y-5"><h1 className="text-2xl font-semibold">Não foi possível carregar esta página</h1><p>Confira sua conexão e tente novamente. Se o problema continuar, entre em contato com o responsável pelo serviço.</p><button className="underline text-pen" onClick={reset}>Tentar novamente</button><Link className="block underline" href="/">Voltar ao início</Link></main>;
}

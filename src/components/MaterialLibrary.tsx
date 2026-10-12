"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { MaterialDetail, MaterialRow } from "@/lib/types";
import { PdfViewer } from "./PdfViewer";
import { Button, EmptyState, Spinner } from "@/components/ui";

export function MaterialLibrary() {
  const [page, setPage] = useState(0);
  const [list, setList] = useState<MaterialRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<MaterialDetail | null>(null);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<MaterialRow[]>(`/api/materials?limit=50&offset=${page * 50}`, { signal: controller.signal })
      .then((rows) => { setList(rows); setError(""); })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar os materiais.");
      });
    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    api<MaterialDetail>(`/api/materials/${selectedId}`, { signal: controller.signal })
      .then((material) => {
        setActive(material);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível abrir o material.");
      });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (active) heading.current?.focus();
  }, [active]);

  function changePage(next: number) {
    setList(null);
    setError("");
    setPage(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Materiais de estudo</h1>
        <p className="text-ink-soft mt-1">Leia os materiais disponibilizados pelo administrador.</p>
      </div>
      {error && <p role="alert" className="text-red">{error}</p>}
      {selectedId ? (
        <section className="card p-5 sm:p-8" aria-busy={!active && !error}>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setActive(null); setError(""); }}>
            Voltar aos materiais
          </Button>
          {active ? (
            <>
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold mt-5 break-words">{active.title}</h2>
              <p className="text-xs text-muted mt-2 mb-6">
                {list?.find((m) => m.id === active.id)?.subjectName}
                {active.pageCount > 0 ? ` · ${active.pageCount} pág.` : ""} · Somente leitura
              </p>
              {active.hasPdf && <PdfViewer id={active.id} title={active.title} />}
              <article className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed break-words">{active.content}</article>
            </>
          ) : !error ? <div role="status" className="flex items-center gap-2 py-8"><Spinner size={20} /> Abrindo material…</div> : null}
        </section>
      ) : list === null ? (
        !error && <div role="status" className="card p-8 flex justify-center gap-2"><Spinner size={22} /> Carregando materiais…</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<BookOpenText size={20} />} title="Nenhum material disponível" desc="Os materiais aparecerão aqui quando forem disponibilizados pelo administrador." />
      ) : (
        <section aria-label="Materiais disponíveis" className="card divide-y divide-line">
          {list.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <FileText size={20} className="text-pen shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-40">
                <h2 className="text-sm font-semibold break-words">{m.title}</h2>
                <p className="text-xs text-muted mt-1">{m.subjectName}{m.pageCount > 0 ? ` · ${m.pageCount} pág.` : ""}</p>
              </div>
              <Button size="sm" variant="soft" aria-label={`Ler material: ${m.title}`} onClick={() => { setActive(null); setError(""); setSelectedId(m.id); }}>
                <BookOpenText size={16} /> Ler material
              </Button>
            </div>
          ))}
        </section>
      )}
      {!selectedId && list !== null && (page > 0 || list.length >= 50) && (
        <nav aria-label="Páginas de materiais" className="flex items-center gap-3">
          <Button variant="ghost" disabled={page === 0} onClick={() => changePage(page - 1)}>Anterior</Button>
          <span>Página {page + 1}</span>
          <Button variant="ghost" disabled={list.length < 50} onClick={() => changePage(page + 1)}>Próxima</Button>
        </nav>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { MaterialDetail, MaterialRow } from "@/lib/types";
import { PdfViewer } from "./PdfViewer";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";

type MaterialFormat = "pdf" | "text";

export function MaterialLibrary() {
  const [page, setPage] = useState(0);
  const [list, setList] = useState<MaterialRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MaterialFormat>("text");
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

  function openMaterial(material: MaterialRow, format: MaterialFormat) {
    setActive(null);
    setError("");
    setSelectedFormat(format);
    setSelectedId(material.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Materiais de estudo</h1>
        <p className="text-ink-soft mt-1">Escolha entre os arquivos PDF originais e os materiais em texto para estudar.</p>
      </div>
      {error && <p role="alert" className="text-red">{error}</p>}
      {selectedId ? (
        <section className="card p-5 sm:p-8" aria-busy={!active && !error}>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setActive(null); setError(""); }}>
            Voltar aos materiais
          </Button>
          {active ? (
            <>
              <div className="mt-5"><Badge tone={selectedFormat === "pdf" ? "pen" : "brand"}>{selectedFormat === "pdf" ? "PDF original" : "Material em texto"}</Badge></div>
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold mt-3 break-words">{active.title}</h2>
              <p className="text-xs text-muted mt-2 mb-6">
                {list?.find((m) => m.id === active.id)?.subjectName}
                {selectedFormat === "pdf" && active.pageCount > 0 ? ` · ${active.pageCount} pág.` : ""} · Somente leitura
              </p>
              {selectedFormat === "pdf" ? (
                active.hasPdf ? <>
                  <p className="text-sm text-muted">Arquivo original, com a formatação e as páginas do PDF.</p>
                  <PdfViewer id={active.id} title={active.title} defaultOpen />
                  {active.content.trim() && <div className="mt-5 border-t border-line pt-4"><Button variant="ghost" size="sm" onClick={() => setSelectedFormat("text")}><BookOpenText size={16} aria-hidden="true" /> Ler a versão em texto</Button></div>}
                </> : <p className="text-sm text-muted">O PDF original deste material ainda não foi anexado.</p>
              ) : <>
                <div className="mb-6 rounded-xl border border-line bg-brand-soft/40 p-4">
                  <p className="text-sm text-ink-soft">Conteúdo copiado ou extraído do PDF, organizado para leitura em texto.</p>
                  {active.hasPdf && <Button className="mt-3" variant="ghost" size="sm" onClick={() => setSelectedFormat("pdf")}><FileText size={16} aria-hidden="true" /> Abrir o PDF original</Button>}
                </div>
                <article className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed break-words">{active.content}</article>
              </>}
            </>
          ) : !error ? <div role="status" className="flex items-center gap-2 py-8"><Spinner size={20} /> Abrindo material…</div> : null}
        </section>
      ) : list === null ? (
        !error && <div role="status" className="card p-8 flex justify-center gap-2"><Spinner size={22} /> Carregando materiais…</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<BookOpenText size={20} />} title="Nenhum material disponível" desc="Os materiais aparecerão aqui quando forem disponibilizados pelo administrador." />
      ) : (
        <div className="space-y-6">
          <MaterialSection format="pdf" items={list.filter(material => material.hasPdf)} onOpen={openMaterial} />
          <MaterialSection format="text" items={list.filter(material => material.charCount > 0)} onOpen={openMaterial} />
        </div>
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

function MaterialSection({ format, items, onOpen }: { format: MaterialFormat; items: MaterialRow[]; onOpen: (material: MaterialRow, format: MaterialFormat) => void }) {
  const pdf = format === "pdf";
  const Icon = pdf ? FileText : BookOpenText;
  return <section aria-label={pdf ? "PDFs originais" : "Materiais em texto"} className="card overflow-hidden">
    <div className={`flex items-start gap-3 border-b border-line p-5 sm:p-6 ${pdf ? "bg-pen-soft/40" : "bg-brand-soft/50"}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${pdf ? "bg-pen-soft text-pen" : "bg-brand text-ink"}`}><Icon size={22} aria-hidden="true" /></span>
      <div>
        <h2 className="font-display text-xl font-semibold">{pdf ? "PDFs originais" : "Materiais em texto"}</h2>
        <p className="mt-1 text-sm text-muted">{pdf ? "Abra ou baixe o arquivo completo, com suas páginas e formatação." : "Leia o conteúdo copiado ou extraído dos PDFs diretamente no site."}</p>
      </div>
    </div>
    {items.length === 0 ? <p className="p-5 text-sm text-muted">{pdf ? "Nenhum PDF original anexado nesta página." : "Nenhum material em texto nesta página."}</p> : <div className="divide-y divide-line">
      {items.map(material => <div key={material.id} className="flex flex-wrap items-center gap-3 p-5">
        <div className="min-w-40 flex-1">
          <div className="mb-2"><Badge tone={pdf ? "pen" : "brand"}>{pdf ? "Arquivo PDF" : "Texto para leitura"}</Badge></div>
          <h3 className="break-words text-sm font-semibold">{material.title}</h3>
          <p className="mt-1 text-xs text-muted">{material.subjectName}{pdf ? material.pageCount > 0 ? ` · ${material.pageCount} pág.` : "" : ` · ${material.charCount.toLocaleString("pt-BR")} caracteres`}</p>
          {pdf && material.charCount > 0 && <p className="mt-1 text-xs text-muted">Também disponível na seção Materiais em texto.</p>}
          {!pdf && material.hasPdf && <p className="mt-1 text-xs text-muted">Também disponível na seção PDFs originais.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={pdf ? "primary" : "soft"} aria-label={`${pdf ? "Abrir PDF" : "Ler texto"}: ${material.title}`} onClick={() => onOpen(material, format)}>
            <Icon size={16} aria-hidden="true" /> {pdf ? "Abrir PDF" : "Ler texto"}
          </Button>
          {pdf && <a href={`/api/materials/${material.id}/pdf?download=1`} aria-label={`Baixar PDF: ${material.title}`} className="text-sm font-semibold text-pen underline underline-offset-4">Baixar PDF</a>}
        </div>
      </div>)}
    </div>}
  </section>;
}

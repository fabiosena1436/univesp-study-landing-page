"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, FolderOpen, Upload, X } from "lucide-react";
import { pdfValidationError } from "@/lib/pdfValidation";
import { Button, Spinner } from "./ui";

type Props = {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onSave: () => void;
  saveLabel: string;
  busy: boolean;
};

export function PdfFilePicker({ title, description, file, onChange, onSave, saveLabel, busy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  return <div className="space-y-4">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pen-soft text-pen">
        <FileText size={22} aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>

    <div className="rounded-2xl border-2 border-dashed border-pen/25 bg-pen-soft/30 p-5 sm:p-6">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        disabled={busy}
        aria-label={`Selecionar arquivo: ${title}`}
        onChange={event => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          const problem = pdfValidationError(selected.name, selected.type, selected.size);
          setError(problem ?? "");
          onChange(problem ? null : selected);
          event.target.value = "";
        }}
      />

      {file ? <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-card p-3 sm:p-4">
        <CheckCircle2 size={22} className="shrink-0 text-green" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{file.name}</p>
          <p className="mt-1 text-xs text-muted">PDF selecionado · {(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB</p>
        </div>
        <button type="button" disabled={busy} onClick={() => { onChange(null); setError(""); }} aria-label="Remover PDF selecionado" className="cursor-pointer rounded-lg p-2 text-muted transition hover:bg-red-soft hover:text-red focus-visible:outline-2 focus-visible:outline-pen disabled:opacity-50">
          <X size={18} aria-hidden="true" />
        </button>
      </div> : <div className="mb-4">
        <p className="font-semibold">Escolha o PDF no seu computador</p>
        <p className="mt-1 text-sm text-muted">Clique em Buscar PDF para selecionar o arquivo.</p>
      </div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" size="lg" variant={file ? "ghost" : "primary"} disabled={busy} onClick={() => input.current?.click()} className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen sm:w-auto">
          <FolderOpen size={20} aria-hidden="true" /> {file ? "Trocar PDF" : "Buscar PDF"}
        </Button>
        {file && <Button type="button" size="lg" disabled={busy} onClick={onSave} className="w-full sm:w-auto">
          {busy ? <><Spinner size={18} /> Salvando PDF…</> : <><Upload size={18} aria-hidden="true" /> {saveLabel}</>}
        </Button>}
      </div>
      <p className="mt-3 text-xs text-muted">Somente PDF · Até 4 MB e 500 páginas</p>
      {file && !busy && <p className="mt-2 text-sm text-pen">Arquivo pronto. Clique em {saveLabel} para concluir.</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red">{error}</p>}
    </div>
  </div>;
}

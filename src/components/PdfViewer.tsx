"use client";
import { useState } from "react";
import { Button } from "./ui";

export function PdfViewer({ id, title, defaultOpen = false }: { id: string; title: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const url = `/api/materials/${id}/pdf`;
  return <div className="my-4 space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="soft" size="sm" onClick={() => setOpen(value => !value)} aria-expanded={open}>{open ? "Fechar PDF" : "Visualizar PDF"}</Button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-pen underline">Abrir PDF em nova aba</a>
      <a href={`${url}?download=1`} className="text-sm text-pen underline">Baixar PDF</a>
    </div>
    {open && <iframe src={url} title={`PDF: ${title}`} className="w-full h-[70vh] rounded-xl border border-line" />}
  </div>;
}

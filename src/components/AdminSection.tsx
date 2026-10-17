"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function AdminSection({ title, children, id, openEvent, defaultOpen = false, nested = false }: {
  title: string;
  children: ReactNode;
  id?: string;
  openEvent?: string;
  defaultOpen?: boolean;
  nested?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const expand = () => { if (details.current) details.current.open = true; };
    const expandHash = () => { if (id && window.location.hash === `#${id}`) expand(); };
    expandHash();
    window.addEventListener("hashchange", expandHash);
    if (openEvent) window.addEventListener(openEvent, expand);
    return () => {
      window.removeEventListener("hashchange", expandHash);
      if (openEvent) window.removeEventListener(openEvent, expand);
    };
  }, [id, openEvent]);

  const Heading = nested ? "h3" : "h2";
  return <details ref={details} id={id} open={defaultOpen} className={`min-w-0 scroll-mt-40 [&[open]>summary>.expand-label]:hidden [&[open]>summary>.collapse-label]:inline ${nested ? "border-t border-line pt-5" : "card p-5"}`}>
    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pen">
      <Heading className={`font-semibold ${nested ? "text-lg" : "text-xl"}`}>{title}</Heading>
      <span className="expand-label text-sm font-semibold text-pen">Expandir</span>
      <span className="collapse-label hidden text-sm font-semibold text-pen">Ocultar</span>
    </summary>
    <div className="mt-4 space-y-4">{children}</div>
  </details>;
}

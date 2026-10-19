"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

// Only acknowledge an individual item after it has actually been on screen.
export function ReadReceipt({ kind, id, version, unread }: { kind: "ticket" | "notice"; id: string; version: string; unread: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  const saved = useRef("");
  useEffect(() => {
    if (!unread || !marker.current || saved.current === version) return;
    let visible = false, busy = false, alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!visible || document.visibilityState !== "visible" || document.getElementById("user-notifications") || busy || saved.current === version) return;
      timer = setTimeout(() => {
        if (!alive || !visible || document.visibilityState !== "visible" || document.getElementById("user-notifications")) return;
        busy = true;
        void api(kind === "ticket" ? "/api/support" : "/api/announcements", { method: "PATCH", body: JSON.stringify(kind === "ticket" ? { ticketId: id, read: true, viewedAt: version } : { id, read: true }) })
          .then(() => { saved.current = version; })
          .catch(() => { /* Keep the unread indicator and the manual read action. */ })
          .finally(() => { busy = false; });
      }, 1000);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
    observer.observe(marker.current);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => { alive = false; clearTimeout(timer); observer.disconnect(); document.removeEventListener("visibilitychange", schedule); window.removeEventListener("focus", schedule); window.removeEventListener("scroll", schedule); };
  }, [id, kind, unread, version]);
  return <span ref={marker} aria-hidden="true" className="block h-px" />;
}

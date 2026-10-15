"use client";
import { useEffect } from "react";
import { api } from "@/lib/api";
export function ActivityTracker() {
  useEffect(() => {
    let lastInteraction = Date.now(), pending = false;
    const touch = () => { lastInteraction = Date.now(); };
    const pulse = async () => {
      if (pending || document.visibilityState !== "visible" || Date.now() - lastInteraction > 120000) return;
      pending = true;
      try { await api("/api/activity", { method: "POST" }); } catch { /* Activity must not interrupt study. */ }
      finally { pending = false; }
    };
    const events = ["pointerdown", "keydown", "scroll"];
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    void pulse();
    const timer = window.setInterval(() => { void pulse(); }, 60000);
    return () => { window.clearInterval(timer); for (const name of events) window.removeEventListener(name, touch); };
  }, []);
  return null;
}

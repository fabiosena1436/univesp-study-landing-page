"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type Point = { x: number; y: number };
const storageKey = "aprova:assistant-position";

export function useAssistantPosition(mobileQuiz: boolean, onTouchTap: () => void) {
  const launcher = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; pointer: Point; origin: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const latestPosition = useRef<Point | null>(null);

  const clamp = useCallback((point: Point): Point => {
    const rect = launcher.current?.getBoundingClientRect();
    return {
      x: Math.max(8, Math.min(point.x, window.innerWidth - (rect?.width ?? 190) - 8)),
      y: Math.max(8, Math.min(point.y, window.innerHeight - (rect?.height ?? 60) - 8)),
    };
  }, []);
  const move = useCallback((point: Point) => {
    const next = clamp(point);
    latestPosition.current = next;
    setPosition(next);
  }, [clamp]);
  function save() {
    try {
      if (latestPosition.current) sessionStorage.setItem(storageKey, JSON.stringify(latestPosition.current));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Position is optional when browser storage is unavailable. */ }
  }
  useEffect(() => {
    let alive = true;
    const restore = () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (alive && saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) move(saved);
      } catch { /* Use the default position. */ }
    };
    void Promise.resolve().then(restore);
    const resize = () => { if (latestPosition.current) move(latestPosition.current); };
    window.addEventListener("resize", resize);
    return () => { alive = false; window.removeEventListener("resize", resize); cleanupDrag.current?.(); };
  }, [move]);

  const docked = () => mobileQuiz && window.innerWidth < 640;
  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    cleanupDrag.current?.();
    const rect = event.currentTarget.getBoundingClientRect();
    suppressClick.current = false;
    drag.current = { id: event.pointerId, pointer: { x: event.clientX, y: event.clientY }, origin: { x: rect.x, y: rect.y }, moved: false };
    const onMove = (next: globalThis.PointerEvent) => onPointerMove(next);
    const onEnd = (next: globalThis.PointerEvent) => {
      if (drag.current?.id !== next.pointerId) return;
      onPointerEnd(next);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      cleanupDrag.current = null;
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    cleanupDrag.current = cleanup;
  }
  function onPointerMove(event: globalThis.PointerEvent) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.pointer.x, dy = event.clientY - current.pointer.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true;
    suppressClick.current = true;
    if (!docked()) move({ x: current.origin.x + dx, y: current.origin.y + dy });
  }
  function onPointerEnd(event: globalThis.PointerEvent) {
    if (drag.current?.id !== event.pointerId) return;
    if (drag.current.moved) save();
    else if (event.type === "pointerup" && event.pointerType === "touch") onTouchTap();
    drag.current = null;
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey || docked()) return;
    const direction: Record<string, Point> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
    const delta = direction[event.key], rect = launcher.current?.getBoundingClientRect();
    if (!delta || !rect) return;
    event.preventDefault();
    move({ x: rect.x + delta.x, y: rect.y + delta.y });
    save();
  }
  function reset() { latestPosition.current = null; setPosition(null); save(); }
  function allowClick() { if (suppressClick.current) { suppressClick.current = false; return false; } return true; }
  return {
    launcher, position, reset, allowClick,
    handlers: { onPointerDown, onKeyDown },
  };
}

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface Polled<T> {
  data: T | null;
  /** Message for the last failed request; data, if any, is the last good copy. */
  error: string | null;
  /** True until the first response (good or bad) for the current URL arrives. */
  loading: boolean;
  /** When the browser last received a good response. */
  receivedAt: number | null;
  refresh: () => void;
}

interface PollState<T> {
  data: T | null;
  error: string | null;
  receivedAt: number | null;
  /** The URL the latest settled response belongs to. */
  settledUrl: string | null;
}

/**
 * Fetches a JSON route and refreshes it on an interval. Pauses while the tab is hidden and
 * refreshes when it comes back; keeps the last good data through errors; cancels on unmount.
 */
export function usePolled<T>(url: string | null, intervalMs: number): Polled<T> {
  const [state, setState] = useState<PollState<T>>({ data: null, error: null, receivedAt: null, settledUrl: null });
  const controller = useRef<AbortController | null>(null);
  const lastFetch = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    lastFetch.current = Date.now();
    try {
      const response = await fetch(url, { signal: ctrl.signal });
      const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setState({ data: body, error: null, receivedAt: Date.now(), settledUrl: url });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const message =
        e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Could not reach the POLARIS server";
      setState((s) => ({ ...s, error: message, settledUrl: url }));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetch.current > intervalMs) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      controller.current?.abort();
    };
  }, [url, intervalMs, load]);

  return {
    data: state.data,
    error: state.error,
    loading: url !== null && state.settledUrl !== url,
    receivedAt: state.receivedAt,
    refresh: load,
  };
}

/* A shared ticking clock. One interval per period, however many components read it. */
const clocks = new Map<number, { now: number; listeners: Set<() => void>; timer: number | null }>();

function subscribeClock(ms: number, listener: () => void) {
  let clock = clocks.get(ms);
  if (!clock) {
    clock = { now: Date.now(), listeners: new Set(), timer: null };
    clocks.set(ms, clock);
  }
  const c = clock;
  c.listeners.add(listener);
  if (c.timer === null) {
    c.now = Date.now();
    c.timer = window.setInterval(() => {
      c.now = Date.now();
      for (const l of c.listeners) l();
    }, ms);
  }
  return () => {
    c.listeners.delete(listener);
    if (c.listeners.size === 0 && c.timer !== null) {
      window.clearInterval(c.timer);
      c.timer = null;
    }
  };
}

/**
 * Current time in ms, re-rendering every `ms`, so relative ages ("4 min ago") stay true.
 * Returns null during server rendering and hydration, so markup never disagrees.
 */
export function useClock(ms = 30_000): number | null {
  return useSyncExternalStore(
    useCallback((l: () => void) => subscribeClock(ms, l), [ms]),
    () => clocks.get(ms)?.now ?? Date.now(),
    () => null,
  );
}

/** Like useClock, but falls back to the render time where a number is required. */
export function useNow(ms = 30_000): number {
  const now = useClock(ms);
  const [fallback] = useState(() => Date.now());
  return now ?? fallback;
}

function subscribeReducedMotion(listener: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

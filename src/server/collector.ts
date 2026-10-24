import "server-only";
import { ProviderError } from "./http";
import type { SourceStatus } from "@/lib/types";

/**
 * A collector owns one upstream dataset. It refreshes on demand (no background timers, so an
 * idle site spends no provider quota), never runs two refreshes at once, keeps serving the last
 * good payload when a refresh fails, and backs off exponentially — or for exactly as long as
 * the provider asked — before trying again.
 */
export interface CollectorState<T> {
  data: T | null;
  lastSuccess: number | null;
  lastAttempt: number | null;
  lastError: string | null;
  /** Epoch ms before which no new upstream request is made. */
  nextAttempt: number;
  failures: number;
  limited: boolean;
}

export interface CollectorOptions<T> {
  id: string;
  /** Serve cached data without refreshing for this long. */
  ttlMs: number;
  /** Longest backoff after repeated failures. */
  maxBackoffMs?: number;
  load: () => Promise<T>;
}

export interface Collector<T> {
  id: string;
  ttlMs: number;
  /** Returns the freshest data available, refreshing first when the cache is due. */
  get(): Promise<CollectorState<T>>;
  /** Current state without touching the network. */
  peek(): CollectorState<T>;
}

// Survive dev-server hot reloads without spawning duplicate collectors.
const registry = ((globalThis as { __polarisCollectors?: Map<string, unknown> })
  .__polarisCollectors ??= new Map<string, unknown>());

export function createCollector<T>(options: CollectorOptions<T>): Collector<T> {
  const existing = registry.get(options.id) as Collector<T> | undefined;
  if (existing) return existing;

  const { id, ttlMs, maxBackoffMs = 30 * 60_000, load } = options;
  const state: CollectorState<T> = {
    data: null,
    lastSuccess: null,
    lastAttempt: null,
    lastError: null,
    nextAttempt: 0,
    failures: 0,
    limited: false,
  };
  let inflight: Promise<void> | null = null;

  async function refresh() {
    state.lastAttempt = Date.now();
    try {
      state.data = await load();
      state.lastSuccess = Date.now();
      state.lastError = null;
      state.failures = 0;
      state.limited = false;
      state.nextAttempt = state.lastSuccess + ttlMs;
    } catch (error) {
      state.failures += 1;
      state.lastError = describe(error);
      const providerWait =
        error instanceof ProviderError && error.retryAfterSeconds !== null
          ? error.retryAfterSeconds * 1000
          : null;
      state.limited = error instanceof ProviderError && error.isQuota;
      const backoff = Math.min(maxBackoffMs, 15_000 * 2 ** (state.failures - 1));
      state.nextAttempt = Date.now() + Math.max(providerWait ?? 0, backoff);
      console.warn(`[collector:${id}] refresh failed (${state.failures}): ${state.lastError}`);
    }
  }

  const collector: Collector<T> = {
    id,
    ttlMs,
    async get() {
      if (Date.now() >= state.nextAttempt) {
        inflight ??= refresh().finally(() => {
          inflight = null;
        });
      }
      // With cached data in hand, a slow upstream should not hold the visitor up for long.
      if (inflight) {
        if (state.data === null) await inflight;
        else await Promise.race([inflight, new Promise((r) => setTimeout(r, 2_500))]);
      }
      return state;
    },
    peek() {
      return state;
    },
  };

  registry.set(id, collector);
  return collector;
}

export function statusOf(
  state: CollectorState<unknown>,
  newestObservationMs: number | null,
  freshnessMs: number,
): SourceStatus {
  if (state.lastAttempt === null) return "idle";
  if (state.limited && state.data === null) return "limited";
  if (state.data === null) return "down";
  if (state.lastError && state.limited) return "limited";
  const reference = newestObservationMs ?? state.lastSuccess ?? 0;
  if (Date.now() - reference > freshnessMs) return "stale";
  return state.lastError ? "stale" : "live";
}

function describe(error: unknown): string {
  if (error instanceof ProviderError) {
    if (error.isQuota) return "Daily request quota reached; waiting for the provider's window to reset";
    return error.message;
  }
  if (error instanceof Error) return error.message.slice(0, 200);
  return "Unknown error";
}

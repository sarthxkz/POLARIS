"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCount, formatUtcDay, formatUtcShort } from "@/lib/format";
import type { NaturalEvent } from "@/lib/types";
import { cx } from "@/components/ui/primitives";
import { WINDOWS, type WindowDays } from "./state";

const BIN_HOURS: Record<WindowDays, number> = { 1: 1, 3: 3, 7: 6, 14: 12 };
/** A full replay of the window takes this long, whatever its length. */
const REPLAY_MS = 14_000;

interface Props {
  events: NaturalEvent[];
  windowDays: WindowDays;
  setWindowDays: (d: WindowDays) => void;
  cursor: number | null;
  setCursor: (ms: number | null) => void;
  reducedMotion: boolean;
  loading: boolean;
}

/**
 * Observation history for the events on the globe. Each bar counts the dated observations the
 * providers published in that bin (a storm track contributes one per position). Replay moves a
 * cursor through those real samples; nothing between them is interpolated or invented.
 */
export function Timeline({ events, windowDays, setWindowDays, cursor, setCursor, reducedMotion, loading }: Props) {
  const [playing, setPlaying] = useState(false);
  // "Now" is read only in the browser, after hydration, so server and client markup agree.
  const [end, setEnd] = useState(0);
  useEffect(() => setEnd(Date.now()), []);
  const binMs = BIN_HOURS[windowDays] * 3_600_000;
  const start = end - windowDays * 86_400_000;
  const bins = Math.ceil((end - start) / binMs);

  useEffect(() => {
    if (cursor !== null) return;
    const t = window.setInterval(() => setEnd(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [cursor]);

  const counts = useMemo(() => {
    const c = new Array<number>(bins).fill(0);
    for (const e of events) {
      for (const p of e.track) {
        const t = Date.parse(p.time);
        if (t < start || t > end) continue;
        c[Math.min(bins - 1, Math.floor((t - start) / binMs))]! += 1;
      }
    }
    return c;
  }, [events, start, end, bins, binMs]);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  const days = useMemo(() => {
    const out: { t: number; x: number }[] = [];
    if (end === 0) return out;
    const first = new Date(start);
    first.setUTCHours(24, 0, 0, 0);
    for (let t = first.getTime(); t < end; t += 86_400_000) out.push({ t, x: (t - start) / (end - start) });
    return out;
  }, [start, end]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // Playback: advance the cursor through the window with requestAnimationFrame, throttled.
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let acc = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc >= (reducedMotion ? 400 : 120)) {
        const advance = ((end - start) / REPLAY_MS) * acc;
        acc = 0;
        const next = (cursorRef.current ?? start) + advance;
        if (next >= end) {
          setCursor(null);
          setPlaying(false);
          return;
        }
        setCursor(next);
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, start, end, setCursor, reducedMotion]);

  const track = useRef<HTMLDivElement>(null);
  const scrubTo = useCallback(
    (clientX: number) => {
      const rect = track.current?.getBoundingClientRect();
      if (!rect) return;
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setPlaying(false);
      setCursor(f >= 0.995 ? null : start + f * (end - start));
    },
    [start, end, setCursor],
  );

  const onKey = (e: React.KeyboardEvent) => {
    const stepMs = binMs;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCursor(Math.max(start, (cursor ?? end) - stepMs));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (cursor ?? end) + stepMs;
      setCursor(next >= end ? null : next);
    } else if (e.key === "End") {
      setCursor(null);
    } else if (e.key === "Home") {
      setCursor(start);
    }
  };

  const cursorX = cursor === null ? 1 : (cursor - start) / (end - start);

  return (
    <section
      data-occludes-globe
      aria-label="Event history"
      className="absolute right-[calc(var(--panel-w)+24px)] bottom-3 left-[calc(var(--rail-w)+24px)] z-20 flex h-[var(--timeline-h)] min-w-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface px-3 pt-2 pb-2 max-lg:right-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && (cursor === null || cursor >= end)) setCursor(start);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause replay" : "Replay the window"}
          className="press grid size-7 place-items-center rounded-[6px] text-ink hover:bg-hover"
          disabled={total === 0}
        >
          {playing ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setCursor(null);
          }}
          aria-label="Back to live"
          disabled={cursor === null}
          className="press grid size-7 place-items-center rounded-[6px] text-ink-soft hover:bg-hover hover:text-ink disabled:opacity-35"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
        </button>
        <p className="num min-w-0 flex-1 truncate text-[13px]">
          {cursor === null ? (
            <>
              <span className="text-ink">Latest</span>
              <span className="text-ink-faint"> · each event at its newest reported position</span>
            </>
          ) : (
            <>
              <span className="font-medium text-ink">Replay</span>
              <span className="text-ink"> · as of {formatUtcShort(cursor)} UTC</span>
              <span className="text-ink-faint"> · recorded observations only</span>
            </>
          )}
        </p>
        <span className="num hidden text-xs text-ink-faint xl:block">
          {loading ? "…" : `${formatCount(total)} observations, ${BIN_HOURS[windowDays]} h bins`}
        </span>
        <div className="flex gap-0.5" role="radiogroup" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              role="radio"
              aria-checked={windowDays === w.days}
              onClick={() => {
                setPlaying(false);
                setCursor(null);
                setEnd(Date.now());
                setWindowDays(w.days);
              }}
              className={cx(
                "press rounded-[6px] px-1.5 py-1 text-xs",
                windowDays === w.days ? "bg-raised text-ink" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Replay position"
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={cursor ?? end}
        aria-valuetext={cursor === null ? "Latest" : `${formatUtcShort(cursor)} UTC`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) scrubTo(e.clientX);
        }}
        className="relative mt-1.5 min-h-0 flex-1 cursor-ew-resize touch-none"
      >
        <div className="absolute inset-x-0 top-0 bottom-4 flex items-end gap-px">
          {counts.map((c, i) => {
            const past = cursor === null || (i + 1) / bins <= cursorX + 1e-9;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-[2px] transition-colors duration-150"
                style={{
                  height: c === 0 ? 1 : `${Math.max(8, (c / max) * 100)}%`,
                  backgroundColor: c === 0 ? "var(--color-line)" : past ? "var(--color-ink-soft)" : "var(--color-line-strong)",
                }}
                title={`${formatUtcShort(start + i * binMs)} UTC: ${c} observation${c === 1 ? "" : "s"}`}
              />
            );
          })}
        </div>
        {days.map((d) => (
          <span
            key={d.t}
            className="num pointer-events-none absolute bottom-0 -translate-x-1/2 text-2xs text-ink-faint"
            style={{ left: `${d.x * 100}%` }}
          >
            {windowDays === 1 ? "00:00" : formatUtcDay(d.t)}
          </span>
        ))}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-4 w-px"
          style={{ left: `calc(${cursorX * 100}% - 0.5px)`, backgroundColor: cursor === null ? "var(--color-ink-faint)" : "var(--color-cyan)" }}
        />
      </div>
    </section>
  );
}

"use client";

import { Home, Minus, Pause, Play, Plus, Sun } from "lucide-react";
import type { GlobeEngine } from "@/components/globe/engine";

export function GlobeControls({
  engine,
  rotate,
  setRotate,
  besidePanel,
  onFaceSun,
}: {
  engine: GlobeEngine | null;
  rotate: boolean;
  /** Absent when the device asks for reduced motion: then there is no rotation to control. */
  setRotate?: (on: boolean) => void;
  besidePanel: boolean;
  onFaceSun: () => void;
}) {
  const button =
    "press grid size-9 place-items-center text-ink-soft hover:bg-hover hover:text-ink disabled:opacity-40";
  return (
    <div
      data-occludes-globe
      role="group"
      aria-label="Globe camera"
      className={`intro-up absolute right-3 bottom-[calc(46svh+12px)] z-20 flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface md:bottom-[calc(var(--timeline-h)+20px)] ${besidePanel ? "md:right-[calc(var(--panel-w)+24px)]" : ""}`}
    >
      {setRotate && (
        <button
          type="button"
          aria-label={rotate ? "Stop turning the globe" : "Turn the globe slowly"}
          title={rotate ? "Stop turning the globe" : "Turn the globe slowly"}
          aria-pressed={rotate}
          className={`${button} border-b border-line`}
          onClick={() => setRotate(!rotate)}
        >
          {rotate ? <Pause size={15} strokeWidth={1.5} /> : <Play size={15} strokeWidth={1.5} />}
        </button>
      )}
      <button type="button" aria-label="Zoom in" title="Zoom in" className={button} disabled={!engine} onClick={() => engine?.zoom(1)}>
        <Plus size={16} strokeWidth={1.5} />
      </button>
      <button type="button" aria-label="Zoom out" title="Zoom out" className={button} disabled={!engine} onClick={() => engine?.zoom(-1)}>
        <Minus size={16} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Face the Sun"
        title="Face the Sun"
        className={`${button} border-t border-line`}
        disabled={!engine}
        onClick={onFaceSun}
      >
        <Sun size={15} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Reset view"
        title="Reset view"
        className={`${button} border-t border-line`}
        disabled={!engine}
        onClick={() => engine?.home()}
      >
        <Home size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

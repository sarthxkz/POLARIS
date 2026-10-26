"use client";

import { useEffect, useRef } from "react";
import type { GlobeEngine, Selection } from "@/components/globe/engine";

const R = 17;
const LEN = 2 * Math.PI * R;
const SIZE = R * 2 + 6;

/**
 * The signature mark: a cyan ring that draws itself once around the selected object as the
 * camera settles, then follows it while the camera moves. Following writes `transform` directly
 * (no React renders per frame); the draw is a WAAPI animation timed from the engine's flight.
 */
export function SelectionRing({
  engine,
  selection,
  reducedMotion,
  children,
}: {
  engine: GlobeEngine | null;
  selection: Selection | null;
  reducedMotion: boolean;
  /** Content that rides beside the ring (the followed satellite's live readout). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const circle = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!engine) return;
    engine.setHandlers({
      onSelectionScreen: (p) => {
        const el = ref.current;
        if (!el) return;
        if (!p) {
          el.style.opacity = "0";
          return;
        }
        el.style.opacity = "1";
        el.style.transform = `translate(${p.x - SIZE / 2}px, ${p.y - SIZE / 2}px)`;
        // Content riding beside the ring flips to the left when the right side lacks room.
        el.dataset.side = p.x > window.innerWidth - 660 ? "left" : "right";
      },
      onFlight: (seconds) => {
        const c = circle.current;
        if (!c || reducedMotion) return;
        c.getAnimations().forEach((a) => a.cancel());
        c.animate([{ strokeDashoffset: LEN }, { strokeDashoffset: 0 }], {
          duration: 520,
          // Land with the camera: start a little before the flight ends.
          delay: Math.max(0, seconds * 1000 - 350),
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "both",
        });
      },
    });
    return () => engine.setHandlers({ onSelectionScreen: () => {}, onFlight: () => {} });
  }, [engine, reducedMotion]);

  if (!selection) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="group pointer-events-none absolute top-0 left-0 z-10 opacity-0 transition-opacity duration-150"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          ref={circle}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-cyan)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeDasharray={LEN}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      {children}
    </div>
  );
}

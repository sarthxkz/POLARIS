"use client";

import { formatCount } from "@/lib/format";

/**
 * The resting view's one statement: what is on the globe right now, as a sentence in the light
 * display face (not metric tiles). A clause is left out, never guessed, when its feed has no data.
 */
export function LiveSummary({
  aircraft,
  satellites,
  events,
  windowLabel,
}: {
  aircraft: number | null;
  satellites: number | null;
  events: number | null;
  windowLabel: string;
}) {
  const parts: React.ReactNode[] = [];
  if (aircraft !== null) parts.push(<Fig key="a" n={aircraft} label="aircraft are aloft" />);
  if (satellites !== null) parts.push(<Fig key="s" n={satellites} label="satellites are in orbit above" />);
  if (events !== null) parts.push(<Fig key="e" n={events} label={`natural events were observed in the past ${windowLabel}`} />);
  if (parts.length === 0) return null;

  return (
    <p
      style={{ textShadow: "0 1px 2px rgba(4,7,12,0.9), 0 0 18px rgba(4,7,12,0.85)" }}
      className="intro-up pointer-events-none absolute bottom-[calc(var(--timeline-h)+32px)] left-6 z-10 hidden max-w-[30ch] text-[clamp(20px,1.7vw,27px)] leading-[1.32] font-light tracking-[-0.015em] text-ink-soft md:block"
    >
      Right now{" "}
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 2 ? ", " : i === parts.length - 2 ? " and " : "."}
        </span>
      ))}
    </p>
  );
}

function Fig({ n, label }: { n: number; label: string }) {
  return (
    <>
      <span className="num font-normal text-ink">{formatCount(n)}</span> {label}
    </>
  );
}

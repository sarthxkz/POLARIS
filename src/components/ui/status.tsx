import type { SourceStatus } from "@/lib/types";

const STATUS: Record<SourceStatus, { color: string; label: string }> = {
  live: { color: "var(--color-frost)", label: "Live" },
  stale: { color: "var(--color-amber)", label: "Stale" },
  limited: { color: "var(--color-amber)", label: "Rate limited" },
  down: { color: "var(--color-red)", label: "Unavailable" },
  idle: { color: "var(--color-ink-faint)", label: "Not loaded yet" },
};

export function statusLabel(status: SourceStatus) {
  return STATUS[status].label;
}

export function StatusDot({ status, className }: { status: SourceStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={["inline-block size-[7px] shrink-0 rounded-full", className].filter(Boolean).join(" ")}
      style={{ backgroundColor: STATUS[status].color }}
    />
  );
}

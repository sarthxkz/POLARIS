"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** A small switch. The whole row around it is usually the hit area; this is the visual. */
export function Switch({ on }: { on: boolean; color?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full border transition-[background-color,border-color] duration-150",
        on ? "border-transparent" : "border-line-strong bg-transparent",
      )}
      style={on ? { backgroundColor: "var(--color-ink-soft)" } : undefined}
    >
      <span
        className="absolute left-[2px] size-3 rounded-full transition-transform duration-200 ease-[var(--ease-out)]"
        style={{
          transform: on ? "translateX(12px)" : "translateX(0)",
          backgroundColor: on ? "var(--color-ground)" : "var(--color-ink-faint)",
        }}
      />
    </span>
  );
}

export { StatusDot, statusLabel } from "./status";

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "press grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-soft hover:bg-hover hover:text-ink disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Label/value pair for detail panels; values use tabular figures. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-[116px_1fr] gap-3 py-[7px]">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="num min-w-0 text-ink">
        {children}
        {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
      </dd>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("skeleton inline-block", className)} />;
}

/** Inline notice for a block whose data failed or is stale. */
export function Notice({
  tone,
  children,
  action,
}: {
  tone: "warning" | "error" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  const color =
    tone === "error" ? "var(--color-red)" : tone === "warning" ? "var(--color-amber)" : "var(--color-ink-faint)";
  return (
    <div className="flex items-start gap-2 text-[13px] text-ink-soft">
      <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies text and confirms in place: the icon cross-fades to a check and the label says so. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="press flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-ink-soft hover:bg-hover hover:text-ink"
    >
      <span aria-hidden className="relative size-[13px]">
        <Copy
          size={13}
          strokeWidth={1.5}
          className="absolute inset-0 transition-[opacity,scale,filter] duration-200"
          style={{ opacity: state === "copied" ? 0 : 1, scale: state === "copied" ? 0.25 : 1, filter: state === "copied" ? "blur(4px)" : "none" }}
        />
        <Check
          size={13}
          strokeWidth={1.75}
          className="absolute inset-0 text-cyan transition-[opacity,scale,filter] duration-200"
          style={{ opacity: state === "copied" ? 1 : 0, scale: state === "copied" ? 1 : 0.25, filter: state === "copied" ? "none" : "blur(4px)" }}
        />
      </span>
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}

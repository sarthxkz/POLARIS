"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};

/**
 * Read-page scroll behaviour: marks the document once scrolled (the sticky header gains its
 * background) and offers a way back to the top after a screen of reading.
 */
export function ScrollChrome() {
  const y = useSyncExternalStore(subscribe, () => Math.round(window.scrollY / 40) * 40, () => 0);
  const farDown = typeof window !== "undefined" && y > window.innerHeight;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-scrolled", y > 40);
  }, [y]);

  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      aria-label="Back to top"
      tabIndex={farDown ? 0 : -1}
      aria-hidden={!farDown}
      className="press no-print fixed right-5 bottom-5 z-30 grid size-11 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-[opacity,translate] duration-200 ease-[var(--ease-out)] hover:text-ink"
      style={{ opacity: farDown ? 1 : 0, translate: farDown ? "0 0" : "0 8px", pointerEvents: farDown ? "auto" : "none" }}
    >
      <ArrowUp size={17} strokeWidth={1.5} />
    </button>
  );
}

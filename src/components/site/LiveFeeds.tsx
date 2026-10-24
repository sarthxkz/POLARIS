"use client";

import { useEffect, useState } from "react";
import { StatusDot, statusLabel } from "@/components/ui/primitives";
import { formatAge } from "@/lib/format";
import { useNow } from "@/lib/client/usePolled";
import type { SourceHealth } from "@/lib/types";

/** The Sources page's live fragment: every feed's state as the server sees it, rechecked each minute. */
export function LiveFeeds({ initial }: { initial: SourceHealth[] }) {
  const [sources, setSources] = useState(initial);
  const now = useNow(15_000);

  useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/sources");
        if (r.ok) setSources(((await r.json()) as { sources: SourceHealth[] }).sources);
      } catch {
        /* keep the last good state */
      }
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  const live = sources.filter((s) => s.status === "live").length;

  return (
    <div className="rounded-[10px] border border-line bg-ground p-2">
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-2.5">
        <span className="text-[14px] font-medium text-ink">Feeds right now</span>
        <span className="num text-[13px] text-ink-faint">
          {live} of {sources.length} live
        </span>
      </div>
      <ul>
        {sources.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-2.5 py-2.5">
            <StatusDot status={s.status} className="mt-[7px]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-ink">{s.name}</span>
              <span className="num block text-[13px] text-ink-faint">
                {s.lastSuccess ? `Last retrieved ${formatAge(s.lastSuccess, now)}` : "Not requested yet"}
              </span>
              {s.lastError && <span className="block text-[13px] text-amber">{s.lastError}</span>}
            </span>
            <span className="shrink-0 text-[13px] text-ink-soft">{statusLabel(s.status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

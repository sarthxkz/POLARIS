"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryGlyph } from "@/components/ui/CategoryGlyph";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatAge, formatUtcShort } from "@/lib/format";
import { useNow } from "@/lib/client/usePolled";
import type { NaturalEvent } from "@/lib/types";

/**
 * The live fragment on the Events page: the newest observations, refreshed every two minutes,
 * ages ticking. Each row opens that event on the globe.
 */
export function LiveEventList({ initial, retrievedAt }: { initial: NaturalEvent[]; retrievedAt: string | null }) {
  const [events, setEvents] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(retrievedAt);
  const now = useNow(15_000);

  useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/events?days=1&limit=6");
        if (!r.ok) return;
        const body = (await r.json()) as { events: NaturalEvent[]; retrievedAt: string | null };
        if (body.events.length) setEvents(body.events);
        setFetchedAt(body.retrievedAt);
      } catch {
        /* keep the last good list */
      }
    }, 120_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="rounded-[10px] border border-line bg-ground p-2">
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-2.5">
        <span className="text-[14px] font-medium text-ink">Newest observations</span>
        <span className="num text-[13px] text-ink-faint">
          {fetchedAt ? `checked ${formatAge(fetchedAt, now)}` : "—"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="px-2.5 pb-3 text-[14px] text-ink-soft">No events observed in the past 24 hours.</p>
      ) : (
        <ul>
          {events.slice(0, 6).map((e) => (
            <li key={e.id}>
              <Link
                href={`/?event=${encodeURIComponent(e.id)}`}
                className="flex items-start gap-3 rounded-[6px] px-2.5 py-2.5 transition-colors duration-150 hover:bg-hover"
              >
                <span className="mt-0.5">
                  <CategoryGlyph category={e.category} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[14px] text-ink">{e.title}</span>
                  <span className="num block text-[13px] text-ink-faint">
                    {CATEGORY_LABEL[e.category]} · {formatUtcShort(e.observedAt)} UTC
                  </span>
                </span>
                <span className="num shrink-0 text-[13px] text-ink-soft">{formatAge(e.observedAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

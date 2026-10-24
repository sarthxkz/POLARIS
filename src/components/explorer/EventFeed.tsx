"use client";

import { PanelRightClose } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatAgeShort, formatCount, formatUtcShort, unitLabel } from "@/lib/format";
import { useNow } from "@/lib/client/usePolled";
import type { NaturalEvent } from "@/lib/types";
import { cx, Skeleton } from "@/components/ui/primitives";
import { CategoryGlyph } from "./LayerRail";

type Sort = "newest" | "magnitude";
const PAGE = 40;

function magnitudeLabel(e: NaturalEvent) {
  if (!e.magnitude) return null;
  if (e.category === "earthquakes") return `M${e.magnitude.value.toFixed(1)}`;
  const unit = unitLabel(e.magnitude.unit);
  return `${formatCount(Math.round(e.magnitude.value))} ${unit === "acres" ? "ac" : unit === "hectares" ? "ha" : unit}`;
}

/** Comparable "size" across a mixed list: only earthquakes rank by magnitude; others keep time order after them. */
function bySize(a: NaturalEvent, b: NaturalEvent) {
  const ma = a.category === "earthquakes" ? (a.magnitude?.value ?? 0) : -1;
  const mb = b.category === "earthquakes" ? (b.magnitude?.value ?? 0) : -1;
  return mb - ma || b.observedAt.localeCompare(a.observedAt);
}

export function EventFeed({
  events,
  loading,
  onSelect,
  windowLabel,
  onCollapse,
}: {
  events: NaturalEvent[];
  loading: boolean;
  onSelect: (e: NaturalEvent) => void;
  windowLabel: string;
  /** Desktop only: fold the feed away so the globe owns the right edge. */
  onCollapse?: () => void;
}) {
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);
  const now = useNow(30_000);

  const sorted = useMemo(
    () => [...events].sort(sort === "newest" ? (a, b) => b.observedAt.localeCompare(a.observedAt) : bySize),
    [events, sort],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="flex-1 text-[13px] font-medium text-ink">
          Events <span className="num font-normal text-ink-faint">· {formatCount(events.length)}</span>
        </h2>
        <div className="flex gap-0.5" role="radiogroup" aria-label="Sort events">
          {(["newest", "magnitude"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              onClick={() => setSort(s)}
              className={cx(
                "press rounded-[6px] px-2 py-1 text-xs",
                sort === s ? "bg-raised text-ink" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {s === "newest" ? "Newest" : "Largest quakes"}
            </button>
          ))}
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide the event list"
            title="Hide the event list"
            className="press -mr-1.5 grid size-7 place-items-center rounded-[6px] text-ink-faint hover:bg-hover hover:text-ink"
          >
            <PanelRightClose size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <p className="px-4 pb-2 text-xs text-ink-faint">Last observation in the past {windowLabel}, times in UTC</p>

      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
        {loading &&
          Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-2.5 py-[9px]">
              <Skeleton className="size-4 rounded-full" />
              <span className="flex-1 space-y-1.5">
                <Skeleton className="block h-3.5 w-4/5" />
                <Skeleton className="block h-3 w-2/5" />
              </span>
            </li>
          ))}
        {!loading && sorted.length === 0 && (
          <li className="mx-2.5 mt-1 rounded-[8px] border border-dashed border-line-strong px-3 py-3 text-[13px] text-ink-soft">
            No events match the layers and time window you have on. Turn categories back on in the layer list, or widen the
            window.
          </li>
        )}
        {sorted.slice(0, limit).map((e) => {
          const mag = magnitudeLabel(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="flex w-full items-start gap-3 rounded-[6px] px-2.5 py-[9px] text-left transition-colors duration-150 hover:bg-hover"
              >
                <span className="mt-0.5">
                  <CategoryGlyph category={e.category} magnitude={e.magnitude?.value} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-ink">{e.title}</span>
                  <span className="num mt-0.5 block text-xs text-ink-faint">
                    {CATEGORY_LABEL[e.category]} · {formatUtcShort(e.observedAt)}
                    {e.status === "closed" ? " · closed" : ""}
                  </span>
                </span>
                <span className="num shrink-0 text-right text-xs">
                  {mag && <span className="block text-ink-soft">{mag}</span>}
                  <span className="block text-ink-faint">{formatAgeShort(e.observedAt, now)}</span>
                </span>
              </button>
            </li>
          );
        })}
        {sorted.length > limit && (
          <li className="px-2.5 pt-1">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="press w-full rounded-[6px] py-2 text-[13px] text-ink-soft hover:bg-hover hover:text-ink"
            >
              Show {Math.min(PAGE, sorted.length - limit)} more of {formatCount(sorted.length - limit)}
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}

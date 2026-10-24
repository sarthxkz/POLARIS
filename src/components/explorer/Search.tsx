"use client";

import { Search as SearchIcon, X, MapPin, Clock3, Satellite, Plane, Activity } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import type { PlaceResult } from "@/lib/types";

export interface LocalResult {
  id: string;
  label: string;
  context: string;
  kind: "satellite" | "aircraft" | "event";
  select: () => void;
}

interface Props {
  onPlace: (place: PlaceResult) => void;
  findLocal?: (query: string) => LocalResult[];
  className?: string;
  autoFocus?: boolean;
}

const RECENT_KEY = "polaris.recentPlaces";

function readRecent(): PlaceResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as PlaceResult[];
  } catch {
    return [];
  }
}

function writeRecent(place: PlaceResult) {
  try {
    const next = [place, ...readRecent().filter((p) => p.id !== place.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: recent searches are a convenience only */
  }
}

const KIND_ICON = { satellite: Satellite, aircraft: Plane, event: Activity } as const;

type Row =
  | { type: "place"; place: PlaceResult; recent?: boolean }
  | { type: "local"; item: LocalResult };

export function Search({ onPlace, findLocal, className, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // The latest settled place search, keyed by the text it answered.
  const [result, setResult] = useState<{ q: string; places: PlaceResult[]; error: string | null }>({
    q: "",
    places: [],
    error: null,
  });
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<PlaceResult[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim();
  const settled = result.q === q;
  const places = useMemo(() => (q.length >= 2 && settled ? result.places : []), [q, settled, result.places]);
  const status: "idle" | "loading" | "error" =
    q.length < 2 ? "idle" : !settled ? "loading" : result.error ? "error" : "idle";
  const message = settled ? result.error : null;

  // Debounced place search: one request per pause in typing, never one per keystroke.
  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = (await res.json()) as { results?: PlaceResult[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Search failed");
        setResult({ q, places: body.results ?? [], error: null });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setResult({ q, places: [], error: e instanceof Error ? e.message : "Search failed" });
      }
    }, 320);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const local = useMemo(() => (query.trim().length >= 2 && findLocal ? findLocal(query.trim()) : []), [query, findLocal]);

  const rows: Row[] = useMemo(() => {
    if (query.trim().length < 2) return recent.map((place) => ({ type: "place" as const, place, recent: true }));
    // Names already on the globe that start with the query (ISS, a callsign) outrank fuzzy place matches.
    const needle = query.trim().toLowerCase();
    const leading = local.filter((item) => item.label.toLowerCase().startsWith(needle));
    const trailing = local.filter((item) => !item.label.toLowerCase().startsWith(needle));
    return [
      ...leading.map((item) => ({ type: "local" as const, item })),
      ...places.map((place) => ({ type: "place" as const, place })),
      ...trailing.map((item) => ({ type: "local" as const, item })),
    ];
  }, [query, places, local, recent]);

  const activeIndex = Math.min(active, Math.max(0, rows.length - 1));

  function choose(row: Row) {
    if (row.type === "place") {
      writeRecent(row.place);
      onPlace(row.place);
    } else {
      row.item.select();
    }
    setQuery("");
    setOpen(false);
    input.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(rows.length - 1, activeIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (e.key === "Enter") {
      const row = rows[activeIndex];
      if (row) {
        e.preventDefault();
        choose(row);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  }

  const showList = open && (rows.length > 0 || status !== "idle" || query.trim().length >= 2);

  return (
    <div className={cx("relative", className)}>
      <label className="flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-ink focus-within:border-line-strong">
        <SearchIcon aria-hidden size={16} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
        <span className="sr-only">Search places, coordinates, satellites or flights</span>
        <input
          ref={input}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search a place, coordinates, satellite or flight"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && rows[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="press -mr-1 grid size-7 place-items-center rounded text-ink-faint hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        )}
      </label>

      {showList && (
        <div
          className="absolute inset-x-0 top-[calc(100%+6px)] z-40 origin-top overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-150 ease-[var(--ease-out)] starting:-translate-y-1 starting:opacity-0"
        >
          <ul id={listId} role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
            {query.trim().length < 2 && rows.length > 0 && (
              <li className="px-3 pt-1.5 pb-1 text-xs text-ink-faint" role="presentation">
                Recent places
              </li>
            )}
            {rows.map((row, i) => {
              const Icon =
                row.type === "place" ? (row.recent ? Clock3 : MapPin) : KIND_ICON[row.item.kind];
              const label = row.type === "place" ? row.place.name : row.item.label;
              const context = row.type === "place" ? row.place.context : row.item.context;
              return (
                <li
                  key={row.type === "place" ? row.place.id : row.item.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}
                  onMouseMove={() => setActive(i)}
                  className={cx(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-2",
                    i === activeIndex ? "bg-hover" : "",
                  )}
                >
                  <Icon aria-hidden size={15} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
                  <span className="max-w-[45%] shrink-0 truncate text-xs text-ink-faint">{context}</span>
                </li>
              );
            })}
            {status === "loading" && rows.length === 0 && (
              <li className="px-3 py-2.5 text-ink-faint" role="presentation">
                Searching…
              </li>
            )}
            {status === "error" && (
              <li className="px-3 py-2.5 text-[13px] text-ink-soft" role="presentation">
                {message}
              </li>
            )}
            {status === "idle" && query.trim().length >= 2 && rows.length === 0 && (
              <li className="px-3 py-2.5 text-[13px] text-ink-soft" role="presentation">
                No place, satellite or flight matches “{query.trim()}”. Coordinates work too: 18.52, 73.85.
              </li>
            )}
          </ul>
          {places.length > 0 && (
            <p className="border-t border-line px-3 py-1.5 text-2xs text-ink-faint">
              Places from Open-Meteo geocoding (GeoNames)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

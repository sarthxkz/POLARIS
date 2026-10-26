"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw, Search as SearchIcon, Settings2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PolarisMark } from "@/components/brand/PolarisMark";
import { cx, StatusDot, statusLabel, Switch } from "@/components/ui/primitives";
import { formatAge, formatClock } from "@/lib/format";
import { useClock, useNow } from "@/lib/client/usePolled";
import type { PlaceResult, SourceHealth, SourceStatus } from "@/lib/types";
import { Search, type LocalResult } from "./Search";

export const NAV = [
  { href: "/", label: "Explore" },
  { href: "/events", label: "Events" },
  { href: "/satellites", label: "Satellites" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
] as const;

interface Props {
  sources: SourceHealth[] | null;
  onPlace: (p: PlaceResult) => void;
  findLocal?: (q: string) => LocalResult[];
  onRefreshSources: () => void;
  lowPower: boolean;
  setLowPower: (v: boolean) => void;
  rotate: boolean;
  setRotate: (v: boolean) => void;
  reducedMotion: boolean;
}

function UtcClock() {
  const now = useClock(1000);
  return (
    <span className="num text-ink-soft" aria-label="Coordinated Universal Time">
      {now ? formatClock(new Date(now)) : "--:--:--"} <span className="text-ink-faint">UTC</span>
    </span>
  );
}

/** Overall status is never "all good" unless every feed is live. */
function summarise(sources: SourceHealth[]) {
  const live = sources.filter((s) => s.status === "live").length;
  const worst: SourceStatus = sources.some((s) => s.status === "down")
    ? "down"
    : sources.some((s) => s.status === "stale" || s.status === "limited")
      ? "stale"
      : live === sources.length
        ? "live"
        : "idle";
  return { live, total: sources.length, worst };
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function FeedStatus({ sources, onRefresh }: { sources: SourceHealth[] | null; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const now = useNow(15_000);

  if (!sources) {
    return <span className="text-ink-faint">Checking feeds…</span>;
  }
  const { live, total, worst } = summarise(sources);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press flex h-9 items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-ink-soft hover:bg-hover hover:text-ink"
      >
        <StatusDot status={worst} />
        <span className="num">
          <span className="hidden sm:inline">
            {live} of {total} feeds live
          </span>
          <span className="sm:hidden" aria-label={`${live} of ${total} feeds live`}>
            {live}/{total} live
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(340px,calc(100vw-24px))] origin-top-right rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-150 ease-[var(--ease-out)] starting:scale-[0.97] starting:opacity-0">
          <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
            <span className="font-medium text-ink">Data feeds</span>
            <button
              type="button"
              onClick={onRefresh}
              className="press flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-ink-soft hover:text-ink"
            >
              <RefreshCw size={12} strokeWidth={1.5} /> Recheck
            </button>
          </div>
          <ul>
            {sources.map((s) => (
              <li key={s.id} className="flex items-start gap-2.5 rounded-[6px] px-2.5 py-2">
                <StatusDot status={s.status} className="mt-[6px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-ink">{s.name}</span>
                    <span className="text-xs text-ink-faint">{statusLabel(s.status)}</span>
                  </div>
                  <div className="num text-xs text-ink-faint">
                    {s.lastSuccess ? `Retrieved ${formatAge(s.lastSuccess, now)}` : "No successful retrieval yet"}
                  </div>
                  {s.lastError && <div className="mt-0.5 text-xs text-amber">{s.lastError}</div>}
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/sources"
            className="mt-1 flex items-center gap-1.5 rounded-[6px] px-2.5 py-2 text-[13px] text-ink-soft hover:bg-hover hover:text-ink"
          >
            How each source is used <ArrowRight aria-hidden size={13} strokeWidth={1.5} />
          </Link>
        </div>
      )}
    </div>
  );
}

function SettingsMenu({
  lowPower,
  setLowPower,
  rotate,
  setRotate,
  reducedMotion,
}: {
  lowPower: boolean;
  setLowPower: (v: boolean) => void;
  rotate: boolean;
  setRotate: (v: boolean) => void;
  reducedMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Display settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="press grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-soft hover:bg-hover hover:text-ink"
      >
        <Settings2 size={17} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] origin-top-right rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-150 ease-[var(--ease-out)] starting:scale-[0.97] starting:opacity-0">
          <button
            type="button"
            onClick={() => setRotate(!rotate)}
            disabled={reducedMotion}
            className="flex w-full items-start gap-3 rounded-[6px] px-2.5 py-2 text-left hover:bg-hover disabled:opacity-50"
            aria-pressed={rotate && !reducedMotion}
          >
            <div className="flex-1">
              <div className="text-ink">Turn the globe when idle</div>
              <div className="text-xs text-ink-faint">
                {reducedMotion
                  ? "Off because your device asks for reduced motion."
                  : "A slow west-to-east turn that pauses whenever you touch the globe."}
              </div>
            </div>
            <Switch on={rotate && !reducedMotion} />
          </button>
          <button
            type="button"
            onClick={() => setLowPower(!lowPower)}
            className="flex w-full items-start gap-3 rounded-[6px] px-2.5 py-2 text-left hover:bg-hover"
            aria-pressed={lowPower}
          >
            <div className="flex-1">
              <div className="text-ink">Low-power globe</div>
              <div className="text-xs text-ink-faint">Lower resolution, no ground atmosphere. Kinder to older devices and batteries.</div>
            </div>
            <Switch on={lowPower} />
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  sources,
  onPlace,
  findLocal,
  onRefreshSources,
  lowPower,
  setLowPower,
  rotate,
  setRotate,
  reducedMotion,
}: Props) {
  const [mobileSearch, setMobileSearch] = useState(false);
  return (
    <>
    <header className="intro-down pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[var(--bar-h)] items-center gap-4 px-3 md:px-4">
      <Link href="/" className="pointer-events-auto flex shrink-0 items-center gap-2.5">
        <span aria-hidden>
          <PolarisMark size={30} />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-medium tracking-[0.08em] text-ink">POLARIS</span>
          <span className="hidden text-2xs text-ink-faint xl:block">Navigate the Bigger Picture.</span>
        </span>
      </Link>

      <div data-occludes-globe className="pointer-events-auto mx-auto hidden w-full max-w-[440px] md:block">
        <Search onPlace={onPlace} findLocal={findLocal} />
      </div>

      <nav data-occludes-globe aria-label="Site" className="pointer-events-auto hidden items-center rounded-[var(--radius-panel)] bg-surface/90 px-1 lg:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.href === "/about" ? undefined : false}
            aria-current={item.href === "/" ? "page" : undefined}
            className={cx(
              "rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] transition-colors duration-150",
              item.href === "/" ? "text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div
        data-occludes-globe
        className="pointer-events-auto ml-auto flex items-center gap-1 rounded-[var(--radius-panel)] bg-surface/90 px-1 md:ml-0"
      >
        <button
          type="button"
          aria-label={mobileSearch ? "Close search" : "Search"}
          onClick={() => setMobileSearch((v) => !v)}
          className="press grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-soft hover:text-ink md:hidden"
        >
          {mobileSearch ? <X size={17} strokeWidth={1.5} /> : <SearchIcon size={17} strokeWidth={1.5} />}
        </button>
        <span className="hidden px-2 text-[13px] sm:block">
          <UtcClock />
        </span>
        <span>
          <FeedStatus sources={sources} onRefresh={onRefreshSources} />
        </span>
        <SettingsMenu
          lowPower={lowPower}
          setLowPower={setLowPower}
          rotate={rotate}
          setRotate={setRotate}
          reducedMotion={reducedMotion}
        />
      </div>
    </header>
    {mobileSearch && (
      <div className="absolute inset-x-3 top-[var(--bar-h)] z-30 md:hidden">
        <Search
          autoFocus
          onPlace={(p) => {
            setMobileSearch(false);
            onPlace(p);
          }}
          findLocal={findLocal}
        />
      </div>
    )}
    </>
  );
}

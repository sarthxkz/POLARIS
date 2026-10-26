"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { EventFeed } from "./EventFeed";
import { LayerRail } from "./LayerRail";
import { SelectionContent, selectionKey } from "./SidePanel";
import { WINDOWS } from "./state";
import type { ExplorerShared } from "./Explorer";

type Tab = "events" | "layers";

/**
 * Phones get one region at a time: a bottom sheet holding the event list or the layers, and the
 * selected object's details when something is chosen. The globe keeps the top of the screen.
 */
export function MobileSheet(props: ExplorerShared) {
  const [tab, setTab] = useState<Tab>("events");
  const [collapsed, setCollapsed] = useState(false);
  const { selection, clearSelection, visibleEvents, events, windowDays, setWindowDays, selectEvent } = props;

  const [shownFor, setShownFor] = useState(selection);
  if (selection !== shownFor) {
    setShownFor(selection);
    if (selection) setCollapsed(false);
  }

  const windowLabel = WINDOWS.find((w) => w.days === windowDays)?.label ?? `${windowDays} days`;

  return (
    <section
      data-occludes-globe
      aria-label="Explorer panel"
      className={cx(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[14px] border-t border-line bg-surface transition-transform duration-300 ease-[var(--ease-drawer)]",
        "h-[46svh]",
      )}
      style={{ transform: collapsed ? "translateY(calc(100% - 52px))" : "translateY(0)" }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        className="mx-auto mt-1.5 mb-0.5 h-5 w-16 shrink-0"
      >
        <span className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
      </button>

      {selection ? (
        <>
          <div className="flex shrink-0 items-center px-2">
            <button
              type="button"
              onClick={clearSelection}
              className="press flex h-11 items-center gap-1.5 rounded-[6px] px-2 text-[14px] text-ink-soft"
            >
              <ArrowLeft size={15} strokeWidth={1.5} /> Back
            </button>
          </div>
          <div key={selectionKey(selection)} className="swap-in min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
            <SelectionContent {...props} />
          </div>
        </>
      ) : (
        <>
          <div className="flex shrink-0 gap-1 px-3 pb-1" role="tablist" aria-label="Panel">
            {(["events", "layers"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setCollapsed(false);
                }}
                className={cx(
                  "press h-10 flex-1 rounded-[8px] text-[14px]",
                  tab === t ? "bg-raised text-ink" : "text-ink-soft",
                )}
              >
                {t === "events" ? "Events" : "Layers"}
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            {tab === "events" ? (
              <div className="absolute inset-0 flex flex-col">
                <div className="flex shrink-0 gap-1 px-3 pt-1" role="radiogroup" aria-label="Observed in the last">
                  {WINDOWS.map((w) => (
                    <button
                      key={w.days}
                      type="button"
                      role="radio"
                      aria-checked={windowDays === w.days}
                      onClick={() => setWindowDays(w.days)}
                      className={cx(
                        "press h-9 flex-1 rounded-[6px] text-[13px]",
                        windowDays === w.days ? "bg-raised text-ink" : "text-ink-faint",
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <EventFeed
                  events={visibleEvents}
                  loading={events.loading && !events.data}
                  onSelect={selectEvent}
                  windowLabel={windowLabel}
                />
              </div>
            ) : (
              <div className="mobile-rail absolute inset-0">
                <LayerRail {...props} embedded />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

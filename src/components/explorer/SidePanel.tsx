"use client";

import { ArrowLeft, PanelRightOpen, X } from "lucide-react";
import { useMemo } from "react";
import { WINDOWS } from "./state";
import { EventFeed } from "./EventFeed";
import { AircraftDetail, EventDetail, MissingSelection, PlaceDetail, SatelliteDetail } from "./Details";
import type { ExplorerShared } from "./Explorer";

export function selectionKey(s: ExplorerShared["selection"]) {
  return s ? `${s.kind}:${s.id}` : "feed";
}

export function SelectionContent(props: ExplorerShared) {
  const { selection, events, aircraft, tracks, satellites, place, visibleEvents, selectEvent, clearSelection, countries } = props;

  const event = useMemo(
    () => (selection?.kind === "event" ? events.data?.events.find((e) => e.id === selection.id) : undefined),
    [selection, events.data],
  );
  const row = useMemo(
    () => (selection?.kind === "aircraft" ? aircraft.data?.aircraft.find((r) => r[0] === selection.id) : undefined),
    [selection, aircraft.data],
  );
  const track = useMemo(
    () => (selection?.kind === "satellite" ? tracks.find((t) => t.noradId === selection.id) : undefined),
    [selection, tracks],
  );

  if (!selection) return null;
  switch (selection.kind) {
    case "event":
      return event ? (
        <EventDetail event={event} events={visibleEvents} onSelect={selectEvent} />
      ) : (
        <MissingSelection what="event" onBack={clearSelection} />
      );
    case "aircraft":
      return row && aircraft.data ? (
        <AircraftDetail row={row} payload={aircraft.data} />
      ) : (
        <MissingSelection what="aircraft" onBack={clearSelection} />
      );
    case "satellite":
      return track ? (
        <SatelliteDetail track={track} retrievedAt={satellites.data?.retrievedAt ?? null} />
      ) : (
        <MissingSelection what="satellite" onBack={clearSelection} />
      );
    case "place":
      return place ? <PlaceDetail place={place} events={visibleEvents} onSelect={selectEvent} countries={countries} /> : null;
  }
}

export function SidePanel(props: ExplorerShared) {
  const { selection, clearSelection, visibleEvents, events, windowDays, selectEvent, feedOpen, setFeedOpen } = props;
  const windowLabel = WINDOWS.find((w) => w.days === windowDays)?.label ?? `${windowDays} days`;

  if (!selection && !feedOpen) {
    return (
      <button
        type="button"
        data-occludes-globe
        onClick={() => setFeedOpen(true)}
        className="press intro-right absolute top-[calc(var(--bar-h)+4px)] right-3 z-20 flex items-center gap-2 rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-[13px] text-ink hover:bg-hover"
      >
        <PanelRightOpen aria-hidden size={15} strokeWidth={1.5} className="text-ink-soft" />
        Events <span className="num text-ink-faint">{visibleEvents.length}</span>
      </button>
    );
  }

  return (
    <aside
      data-occludes-globe
      aria-label={selection ? "Selected object" : "Event feed"}
      className="intro-right absolute top-[calc(var(--bar-h)+4px)] right-3 bottom-[calc(var(--timeline-h)+20px)] z-20 flex w-[var(--panel-w)] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface"
    >
      {selection ? (
        <>
          <div className="flex items-center justify-between px-2 pt-2">
            <button
              type="button"
              onClick={clearSelection}
              className="press flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-ink-soft hover:bg-hover hover:text-ink"
            >
              <ArrowLeft size={14} strokeWidth={1.5} /> Event list
            </button>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Close details"
              className="press grid size-8 place-items-center rounded-[6px] text-ink-faint hover:bg-hover hover:text-ink"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>
          <div key={selectionKey(selection)} className="swap-in min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            <SelectionContent {...props} />
          </div>
        </>
      ) : (
        <div key="feed" className="swap-in flex min-h-0 flex-1 flex-col">
          <EventFeed
            events={visibleEvents}
            loading={events.loading && !events.data}
            onSelect={selectEvent}
            windowLabel={windowLabel}
            onCollapse={() => setFeedOpen(false)}
          />
        </div>
      )}
    </aside>
  );
}

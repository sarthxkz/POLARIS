import type { Metadata } from "next";
import { allHealth, eonet, usgs, celestrak, gibs, opensky } from "@/server/sources";
import { openskyAccess, openskyRefreshSeconds } from "@/server/providers/opensky";
import { formatCount, formatUtc } from "@/lib/format";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Column, PageHero, Row, Section } from "@/components/site/PageHero";
import { LiveFeeds } from "@/components/site/LiveFeeds";
import { StatusDot, statusLabel } from "@/components/ui/status";
import type { SourceHealth } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sources and methods",
  description: "Where every number on POLARIS comes from, how fresh it is, and what it cannot tell you.",
};

function Facts({ s }: { s: SourceHealth }) {
  return (
    <div className="pt-1">
      <Row dot={<StatusDot status={s.status} />} label="Status" value={statusLabel(s.status)} />
      <Row label="Last retrieved" value={s.lastSuccess ? formatUtc(s.lastSuccess) : "—"} />
      {s.lastObservation && <Row label="Newest observation" value={formatUtc(s.lastObservation)} />}
      {s.recordCount !== null && <Row label="Records held" value={formatCount(s.recordCount)} />}
      <Row
        label="Refresh"
        value={
          s.refreshSeconds === 0
            ? "On request, cached 10 min"
            : s.refreshSeconds >= 3600
              ? `Every ${s.refreshSeconds / 3600} h`
              : `Every ${Math.round(s.refreshSeconds / 60)} min`
        }
      />
      {s.lastError && <p className="pt-1 text-[15px] text-amber">{s.lastError}</p>}
    </div>
  );
}

export default async function SourcesPage() {
  // Make sure each feed has been tried at least once before describing it.
  await Promise.allSettled([eonet.get(), usgs.get(), celestrak.get(), gibs.get(), opensky.get()]);
  const health = allHealth();
  const h = (id: SourceHealth["id"]) => health.find((s) => s.id === id)!;

  return (
    <>
      <SiteHeader current="/sources" />
      <main>
        <PageHero
          lines={["Where every number", "on POLARIS comes from"]}
          sentence={
            <>
              Six public sources, each named next to its data with the time it was observed. When one fails, the site
              says so instead of looking full.
            </>
          }
          fragment={<LiveFeeds initial={health} />}
        />

        <Column>
          <Section title="NASA EONET: natural events">
            <p>
              The Earth Observatory Natural Event Tracker curates events from agencies such as InciWeb and IRWIN for US
              wildfires, the Joint Typhoon Warning Center and NOAA for storms, and the Smithsonian for volcanoes. Each
              event carries dated positions; a storm carries one per advisory, which is what the globe draws as its
              track and what the timeline replays.
            </p>
            <p className="text-ink-soft">
              EONET is curated, not instant. A fire may appear hours or days after ignition, and an event can stay open
              long after its last update. POLARIS shows events by their last reported observation inside the window you
              choose.
            </p>
            <Facts s={h("eonet")} />
          </Section>

          <Section title="USGS: earthquakes">
            <p>
              Every earthquake of magnitude 2.5 or more worldwide, from the USGS Earthquake Hazards Program’s real-time
              feed, with the previous week from its event service. Each carries the USGS magnitude type, depth, review
              status, tsunami flag and PAGER alert level exactly as published.
            </p>
            <p className="text-ink-soft">
              “Automatic” solutions come from algorithms and are revised when a seismologist reviews them, so a
              magnitude can change after we show it.
            </p>
            <Facts s={h("usgs")} />
          </Section>

          <Section title="OpenSky Network: aircraft">
            <p>
              Positions broadcast by aircraft transponders (ADS-B and Mode S) and picked up by receivers that OpenSky’s
              volunteers run. POLARIS uses {openskyAccess} access, which allows one worldwide snapshot about every{" "}
              {Math.round(openskyRefreshSeconds / 60)} minutes, so an aircraft on the globe is where it was at the
              snapshot time shown beside it, not where it is now.
            </p>
            <p className="text-ink-soft">
              Coverage follows the receivers: dense over Europe and North America, thin over oceans, Africa and parts of
              Asia. Aircraft that do not broadcast, or fly out of every receiver’s range, do not appear. We show only the
              broadcast identifiers and never look up owners, passengers or flight histories. The short trail on a
              selected aircraft joins only the snapshots this server saw, kept in memory for at most eight snapshots.
            </p>
            <Facts s={h("opensky")} />
          </Section>

          <Section title="CelesTrak: satellites">
            <p>
              Orbital element sets for space stations, the brightest satellites, and weather, GPS and science missions.
              Positions are SGP4 estimates computed in your browser, with the element epoch shown beside each one. They
              are estimates from a model, not observations.
            </p>
            <Facts s={h("celestrak")} />
          </Section>

          <Section title="NASA GIBS: imagery">
            <p>
              The Earth itself is NASA’s Blue Marble; the night side shows VIIRS city lights from the 2016 Black Marble
              composite. Optional layers add the latest daily VIIRS true-colour swaths, GOES and Himawari cloud infrared
              every ten minutes, and GPM IMERG precipitation estimates, each labelled with the time GIBS published it.
              The pictures beside events are VIIRS true colour for the day of observation.
            </p>
            <Facts s={h("gibs")} />
          </Section>

          <Section title="Open-Meteo: weather and place search">
            <p>
              “Weather here now” is Open-Meteo’s blend of national weather models for that point and that hour, not a
              reading from a station. Place search uses Open-Meteo’s geocoding of GeoNames. Both are called only when you
              ask, and cached briefly so repeated questions do not reach the provider.
            </p>
            <Facts s={h("openmeteo")} />
          </Section>

          <Section title="What the statuses mean">
            <div>
              <Row dot={<StatusDot status="live" />} label="Live" sub="The last retrieval worked and the data is within its freshness limit." />
              <Row dot={<StatusDot status="stale" />} label="Stale" sub="We hold data, but it is older than its limit or the last retrieval failed." />
              <Row dot={<StatusDot status="limited" />} label="Rate limited" sub="The provider asked us to wait; we wait exactly as long as it says." />
              <Row dot={<StatusDot status="down" />} label="Unavailable" sub="Retrieval failed and there is no earlier copy to show." />
              <Row dot={<StatusDot status="idle" />} label="Not loaded yet" sub="Nobody has asked for this feed since the server started." />
            </div>
          </Section>

          <Section title="Credits">
            <p className="text-ink-soft">
              Natural events: NASA Earth Observatory Natural Event Tracker (EONET). Earthquakes: U.S. Geological Survey.
              Aircraft: The OpenSky Network, opensky-network.org. Orbital elements: CelesTrak. Imagery: we acknowledge the
              use of imagery from NASA’s Global Imagery Browse Services (GIBS), part of NASA’s Earth Science Data and
              Information System (ESDIS). Weather and geocoding: Open-Meteo.com (CC BY 4.0) and GeoNames. Borders and
              place names: Natural Earth. Globe engine: CesiumJS. Icons: Lucide.
            </p>
          </Section>
        </Column>
        <SiteFooter />
      </main>
    </>
  );
}

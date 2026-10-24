import type { Metadata } from "next";
import Link from "next/link";
import { getEvents } from "@/server/events";
import { requestTime } from "@/lib/clock";
import { CATEGORY_LABEL, CATEGORY_NOUN } from "@/lib/categories";
import { areaHectares, formatCount, formatNumber, formatUtc, formatUtcShort, unitLabel } from "@/lib/format";
import { formatLatLon } from "@/lib/geo";
import type { EventCategory, NaturalEvent } from "@/lib/types";
import { CategoryGlyph } from "@/components/ui/CategoryGlyph";
import { SatelliteView } from "@/components/ui/SatelliteView";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Column, PageHero, Row, Section } from "@/components/site/PageHero";
import { LiveEventList } from "@/components/site/LiveEventList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natural events this week",
  description: "Earthquakes, wildfires, storms and other natural events observed in the past seven days, from NASA EONET and the USGS.",
};

const DAY = 86_400_000;
const link = (e: NaturalEvent) => `/?event=${encodeURIComponent(e.id)}`;

function sizeLabel(e: NaturalEvent) {
  if (!e.magnitude) return null;
  if (e.category === "earthquakes") return `M${e.magnitude.value.toFixed(1)}`;
  return `${formatNumber(e.magnitude.value)} ${unitLabel(e.magnitude.unit)}`;
}

function listSentence(counts: [EventCategory, number][]) {
  const parts = counts.map(([c, n]) => `${formatCount(n)} ${n === 1 ? CATEGORY_NOUN[c] : `${CATEGORY_LABEL[c].toLowerCase()}`}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export default async function EventsPage() {
  const { events, retrievedAt, sources } = await getEvents();
  const now = requestTime();
  const since = new Date(now - 7 * DAY).toISOString();
  const week = events.filter((e) => e.observedAt >= since);
  const down = sources.filter((s) => s.status === "down");

  const counts = new Map<EventCategory, number>();
  for (const e of week) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const quakes = week.filter((e) => e.category === "earthquakes");
  const strongest = quakes.reduce<NaturalEvent | null>(
    (best, e) => ((e.magnitude?.value ?? 0) > (best?.magnitude?.value ?? -1) ? e : best),
    null,
  );
  const storms = events
    .filter((e) => e.category === "severeStorms" && e.observedAt >= new Date(now - 14 * DAY).toISOString())
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const fires = week.filter((e) => e.category === "wildfires");
  // Sources report fire area in acres or hectares; compare in hectares, display as reported.
  const hectares = (e: NaturalEvent) => areaHectares(e.magnitude) ?? 0;
  const largestFire = fires.filter((e) => hectares(e) > 0).sort((a, b) => hectares(b) - hectares(a))[0];
  const others = week.filter((e) => !["earthquakes", "wildfires", "severeStorms"].includes(e.category));
  const notableQuakes = quakes
    .filter((e) => (e.magnitude?.value ?? 0) >= 5)
    .sort((a, b) => (b.magnitude?.value ?? 0) - (a.magnitude?.value ?? 0));

  return (
    <>
      <SiteHeader current="/events" />
      <main>
        <PageHero
          lines={["What the planet did", "in the past seven days"]}
          sentence={
            week.length > 0 ? (
              <>
                {formatCount(week.length)} natural events observed since {formatUtcShort(since)} UTC:{" "}
                {listSentence(ordered)}. Each one links to the agency that reported it.
              </>
            ) : (
              <>No events could be loaded right now. The sources page shows which feed is affected.</>
            )
          }
          action={{ href: "/", label: "See them on the globe" }}
          fragment={<LiveEventList initial={week.slice(0, 6)} retrievedAt={retrievedAt} />}
        />

        <Column>
          {down.length > 0 && (
            <p className="mt-16 text-[15px] text-amber">
              {down.map((s) => (s.id === "usgs" ? "USGS" : "NASA EONET")).join(" and ")} could not be reached; this
              page shows only what the other source reports.
            </p>
          )}

          {strongest && (
            <Section title="The strongest earthquake">
              <p>
                <Link href={link(strongest)} className="underline decoration-line-strong hover:decoration-ink">
                  {strongest.title}
                </Link>
                , at {formatUtc(strongest.observedAt)}
                {strongest.depthKm !== null && strongest.depthKm !== undefined
                  ? `, ${formatNumber(strongest.depthKm, 1)} km deep`
                  : ""}
                . USGS lists its solution as {strongest.status ?? "unreviewed"}
                {strongest.tsunami ? " and raised its tsunami flag" : ""}.
              </p>
              <p className="text-ink-soft">
                {formatCount(quakes.length)} earthquakes of magnitude 2.5 or more were recorded worldwide in the same seven
                days; {formatCount(notableQuakes.length)} reached magnitude 5.
              </p>
              {notableQuakes.length > 0 && (
                <div className="pt-2">
                  {notableQuakes.slice(0, 12).map((e) => (
                    <Row
                      key={e.id}
                      href={link(e)}
                      dot={<CategoryGlyph category={e.category} magnitude={e.magnitude?.value} />}
                      label={e.description ?? e.title}
                      value={`${sizeLabel(e)} · ${formatUtcShort(e.observedAt)}`}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {storms.length > 0 && (
            <Section title="Storms being followed">
              <p>
                EONET follows {formatCount(storms.length)} storm{storms.length === 1 ? "" : "s"} observed in the past two
                weeks. Each position below is one the warning centres published; the globe draws the full track.
              </p>
              <div className="pt-2">
                {storms.map((e) => (
                  <Row
                    key={e.id}
                    href={link(e)}
                    dot={<CategoryGlyph category={e.category} />}
                    label={e.title}
                    sub={`${formatCount(e.track.length)} positions, last at ${formatLatLon(e.lat, e.lon, 1)}`}
                    value={[sizeLabel(e), formatUtcShort(e.observedAt)].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
              <SatelliteView
                lat={storms[0]!.lat}
                lon={storms[0]!.lon}
                observedAt={storms[0]!.observedAt}
                spanDeg={14}
                className="pt-6"
              />
              <p className="text-[14px] text-ink-soft">Around {storms[0]!.title}’s latest reported position.</p>
            </Section>
          )}

          {fires.length > 0 && (
            <Section title="Fires">
              <p>
                {formatCount(fires.length)} wildfires were reported in the past seven days
                {largestFire
                  ? `. The largest by reported area is ${largestFire.title}, at ${formatNumber(largestFire.magnitude!.value)} ${unitLabel(largestFire.magnitude!.unit)}`
                  : ""}
                .
              </p>
              {largestFire && (
                <SatelliteView lat={largestFire.lat} lon={largestFire.lon} observedAt={largestFire.observedAt} spanDeg={1.2} />
              )}
              <div className="pt-2">
                {fires
                  .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
                  .slice(0, 20)
                  .map((e) => (
                    <Row
                      key={e.id}
                      href={link(e)}
                      dot={<CategoryGlyph category={e.category} />}
                      label={e.title}
                      value={[sizeLabel(e), formatUtcShort(e.observedAt)].filter(Boolean).join(" · ")}
                    />
                  ))}
              </div>
              {fires.length > 20 && (
                <p className="text-[15px] text-ink-soft">
                  {formatCount(fires.length - 20)} more are on the{" "}
                  <Link href="/" className="text-ink underline">
                    globe
                  </Link>
                  .
                </p>
              )}
            </Section>
          )}

          {others.length > 0 && (
            <Section title="Volcanoes, water and ice">
              <div>
                {others.map((e) => (
                  <Row
                    key={e.id}
                    href={link(e)}
                    dot={<CategoryGlyph category={e.category} />}
                    label={e.title}
                    sub={CATEGORY_LABEL[e.category]}
                    value={formatUtcShort(e.observedAt)}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="How to read this page">
            <p className="text-ink-soft">
              Times are in UTC and are the time each source observed the event, not when we fetched it. Wildfire areas are
              as reported by the incident system EONET cites, often well after ignition. Earthquake magnitudes are USGS
              solutions and may be revised. Nothing here is a warning; follow your national agencies for that.
            </p>
            <p className="text-ink-soft">
              Data last retrieved {retrievedAt ? formatUtc(retrievedAt) : "—"}.{" "}
              <Link href="/sources" className="text-ink underline">
                Sources and methods
              </Link>
            </p>
          </Section>
        </Column>
        <SiteFooter />
      </main>
    </>
  );
}

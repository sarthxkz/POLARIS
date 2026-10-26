import type { Metadata } from "next";
import Link from "next/link";
import { celestrak, healthOf } from "@/server/sources";
import { SATELLITE_GROUPS } from "@/server/providers/celestrak";
import { formatCount, formatNumber, formatUtc } from "@/lib/format";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Column, PageHero, Row, Section } from "@/components/site/PageHero";
import { LiveSatellite } from "@/components/site/LiveSatellite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Satellites",
  description: "Space stations, the brightest satellites, weather, GPS and science missions, with positions estimated from CelesTrak orbital elements.",
};

export default async function SatellitesPage() {
  const state = await celestrak.get();
  const satellites = state.data?.satellites ?? [];
  const health = healthOf("celestrak");
  const iss = satellites.find((s) => s.NORAD_CAT_ID === 25544) ?? satellites[0];

  return (
    <>
      <SiteHeader current="/satellites" />
      <main id="main" tabIndex={-1} className="outline-none">
        <PageHero
          lines={["Satellites overhead,", "estimated every second"]}
          sentence={
            satellites.length > 0 ? (
              <>
                {formatCount(satellites.length)} satellites in five groups, placed by running their published orbital
                elements through SGP4 in your browser. These are estimates, not tracking.
              </>
            ) : (
              <>Orbital elements could not be loaded from CelesTrak right now. {health.lastError ?? ""}</>
            )
          }
          action={{ href: "/?sat=25544", label: "Follow the ISS" }}
          fragment={
            iss ? (
              <LiveSatellite elements={iss} />
            ) : (
              <p className="text-[15px] text-ink-soft">No orbital elements are available yet.</p>
            )
          }
        />

        <Column>
          <Section title="How the positions are made">
            <p>
              CelesTrak publishes general perturbations element sets for each satellite: a snapshot of its orbit at one
              moment, the epoch. SGP4, the standard model those elements are made for, projects the orbit forward to
              now. POLARIS does that once a second in your browser for every satellite you have switched on.
            </p>
            <p className="text-ink-soft">
              The further from the epoch, the larger the error, typically a kilometre or so per day for low orbits, more
              for satellites that manoeuvre, like the ISS raising its orbit. Each satellite’s panel on the globe shows
              its epoch so you can judge.
            </p>
            <p className="text-ink-soft">
              Elements fetched {state.data ? formatUtc(state.data.oldestFetch) : "—"}, and refreshed no more than
              every two hours, as CelesTrak asks.
              {health.status === "stale" && health.lastError ? ` ${health.lastError}.` : ""}
            </p>
          </Section>

          {SATELLITE_GROUPS.map((g) => {
            const members = satellites
              .filter((s) => s.group === g.id)
              .sort((a, b) => a.OBJECT_NAME.localeCompare(b.OBJECT_NAME));
            return (
              <Section key={g.id} id={g.id} title={`${g.label} (${formatCount(members.length)})`}>
                <p className="text-ink-soft">{g.description}</p>
                {members.length === 0 ? (
                  <p className="text-[15px] text-ink-soft">No element sets in this group right now.</p>
                ) : (
                  <div>
                    {members.slice(0, 40).map((s) => (
                      <Row
                        key={s.NORAD_CAT_ID}
                        href={`/?sat=${s.NORAD_CAT_ID}`}
                        label={s.OBJECT_NAME}
                        value={`${formatNumber(1440 / s.MEAN_MOTION, 0)} min · ${formatNumber(s.INCLINATION, 1)}°`}
                      />
                    ))}
                    {members.length > 40 && (
                      <p className="pt-2 text-[15px] text-ink-soft">
                        {formatCount(members.length - 40)} more in this group are on the{" "}
                        <Link href="/" className="text-ink underline">
                          globe
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                )}
              </Section>
            );
          })}
          <p className="mt-10 text-[14px] text-ink-faint">Each row: orbital period, then inclination.</p>
        </Column>
        <SiteFooter />
      </main>
    </>
  );
}

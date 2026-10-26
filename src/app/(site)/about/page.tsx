import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PolarisMark } from "@/components/brand/PolarisMark";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "About",
  description: "What POLARIS is, what it is not, and how it treats your privacy.",
};

/** Questions a first-time visitor asks, answered with what the site actually does. */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Why is an aircraft not exactly where the plane is now?",
    a: "Aircraft positions come from an OpenSky Network snapshot taken about every 15 minutes. Each aircraft shows where it was at the snapshot time printed beside it, so a fast jet has usually moved on by more than 100 km.",
  },
  {
    q: "Are the satellite positions live?",
    a: "They are estimates. Your browser runs each satellite's published orbital elements through the standard SGP4 model every second. The error is usually around a kilometre per day since the elements were published, and more after a manoeuvre. Each satellite's panel shows how old its elements are.",
  },
  {
    q: "Why are there no aircraft over some oceans and regions?",
    a: "OpenSky only hears aircraft within range of a volunteer's receiver. Coverage is dense over Europe and North America and thin over oceans, Africa and parts of Asia, so an empty area means no receiver, not no aircraft.",
  },
  {
    q: "How fresh are the natural events?",
    a: "Earthquakes come from the USGS feed within minutes. Wildfires, storms, volcanoes and floods come from NASA EONET, which curates reports from other agencies, so they can appear hours or days after they start. Every event shows the time its source observed it.",
  },
  {
    q: "Is “weather here now” a measurement?",
    a: "No. It is Open-Meteo's model estimate for that point and hour, not a reading from a weather station.",
  },
  {
    q: "Can I stop the globe from turning?",
    a: "Yes. Use the pause button above the zoom controls, or the setting in the top bar. It stops by itself whenever you touch the globe, and it never turns if your device asks for reduced motion.",
  },
  {
    q: "Does POLARIS track me?",
    a: "No. There are no accounts, cookies, analytics or ads. Recent place searches stay in your own browser. Imagery loads directly from NASA and EOX servers, and everything else goes through POLARIS's own server.",
  },
];

/**
 * About, set as a letter (the dealt "founder's letter" blueprint) in a centred 560px column.
 * No portrait and no signature name are invented; the mark signs it.
 */
export default function AboutPage() {
  return (
    <>
      <SiteHeader current="/about" />
      <main id="main" tabIndex={-1} className="outline-none">
        <article className="mx-5 max-w-[560px] pt-[clamp(140px,22svh,220px)] text-[17px] leading-[1.6] md:mx-auto">
          <PolarisMark size={44} />
          <h1 className="mt-7 text-[clamp(30px,3.2vw,46px)] leading-[1.05] font-light tracking-[-0.03em] text-ink">
            <span className="mask-line">
              <span>Navigate the</span>
            </span>
            <span className="mask-line">
              <span>bigger picture</span>
            </span>
          </h1>
          <div className="fade-up mt-8 space-y-5 text-ink">
            <p className="font-medium">
              POLARIS is a window on the planet as public agencies see it right now: the fires they map, the earthquakes
              their seismometers catch, the storms their forecasters follow, the aircraft volunteers’ receivers hear, and
              the satellites whose orbits are published every day.
            </p>
            <p>
              None of this is secret. It is spread across a dozen agencies, formats and time zones. POLARIS gathers it on
              one globe, keeps each item’s source and time beside it, and links you back to the agency that reported it.
            </p>
            <p>
              We would rather show less than show something invented. If a feed is down, the site says which one. If a
              position is an estimate, as every satellite position here is, the site says so and shows how old the
              estimate’s inputs are. Severity appears only where the source gives it.
            </p>
            <p>
              POLARIS is not a surveillance tool. It does not track people or devices, recognise faces, or keep movement
              histories of individuals. Aircraft appear only by the identifiers they broadcast, and we do not look up who
              owns them or who is aboard.
            </p>
            <p>
              Your visit stays yours. There are no accounts, no advertising, no analytics and no cookies. The only thing
              stored is a short list of your recent place searches, kept in your own browser so you can find them again.
              Weather and place searches pass through our server, so your browser never contacts those providers
              directly. The globe’s imagery tiles and event pictures do load straight from NASA’s servers.
            </p>
            <p>
              Everything on the site, and how fresh it is, is described on the{" "}
              <Link href="/sources" className="underline decoration-line-strong hover:decoration-ink">
                sources page
              </Link>
              . The globe is the place to start.
            </p>
          </div>
          <div className="mt-12">
            <p className="text-lg font-medium text-ink">POLARIS</p>
            <p className="text-[14px] text-ink-soft">World Intelligence System</p>
          </div>
          <Link
            href="/"
            className="press mt-10 inline-block rounded-[6px] bg-ink px-4 py-2.5 text-[15px] font-medium text-ground"
          >
            Open the globe
          </Link>

          <section aria-labelledby="faq-title" className="mt-[120px]">
            <h2 id="faq-title" className="text-[clamp(24px,2vw,30px)] leading-tight font-normal tracking-[-0.015em] text-ink">
              Questions people ask
            </h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="faq group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-4 text-[17px] text-ink transition-colors duration-150 hover:text-ink-soft">
                    {item.q}
                    <ChevronDown aria-hidden size={18} strokeWidth={1.5} className="faq-chevron mt-1 shrink-0 text-ink-faint" />
                  </summary>
                  <p className="pb-5 text-[17px] leading-[1.6] text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}

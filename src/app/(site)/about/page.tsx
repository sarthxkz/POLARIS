import type { Metadata } from "next";
import Link from "next/link";
import { PolarisMark } from "@/components/brand/PolarisMark";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "About",
  description: "What POLARIS is, what it is not, and how it treats your privacy.",
};

/**
 * About, set as a letter (the dealt "founder's letter" blueprint) in a centred 560px column.
 * No portrait and no signature name are invented; the mark signs it.
 */
export default function AboutPage() {
  return (
    <>
      <SiteHeader current="/about" />
      <main>
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
            <p className="text-[22px] font-light tracking-[-0.01em] text-ink">POLARIS</p>
            <p className="text-[14px] text-ink-soft">World Intelligence System</p>
          </div>
          <Link
            href="/"
            className="press mt-10 inline-block rounded-[6px] bg-ink px-4 py-2.5 text-[15px] font-medium text-ground"
          >
            Open the globe
          </Link>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}

import Link from "next/link";
import { PolarisMark } from "@/components/brand/PolarisMark";

const LINKS = [
  { href: "/events", label: "Events" },
  { href: "/satellites", label: "Satellites" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center gap-3 px-4 sm:gap-6 md:px-10">
      <Link href="/" className="flex items-center gap-2.5" aria-label="POLARIS, back to the globe">
        <PolarisMark size={28} />
        <span className="hidden text-[15px] font-medium tracking-[0.08em] text-ink sm:inline">POLARIS</span>
      </Link>
      <nav aria-label="Site" className="ml-auto flex items-center sm:gap-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={l.href === "/about" ? undefined : false}
            aria-current={current === l.href ? "page" : undefined}
            className={
              current === l.href
                ? "rounded-[6px] px-2 py-2.5 text-[15px] text-ink sm:px-2.5"
                : "rounded-[6px] px-2 py-2.5 text-[15px] text-ink-soft transition-colors duration-150 hover:text-ink sm:px-2.5"
            }
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/"
          className="press ml-2 hidden rounded-[6px] bg-ink px-3 py-2 text-[14px] font-medium text-ground sm:block"
        >
          Open the globe
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-[30svh] grid grid-cols-1 gap-2 px-5 pb-7 text-[14px] md:grid-cols-[1fr_auto_1fr] md:items-baseline md:px-10">
      <span className="text-ink-soft">POLARIS, World Intelligence System</span>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1">
        <Link href="/" className="text-ink hover:underline">
          Globe
        </Link>
        <Link prefetch={false} href="/events" className="text-ink hover:underline">
          Events
        </Link>
        <Link prefetch={false} href="/satellites" className="text-ink hover:underline">
          Satellites
        </Link>
        <Link prefetch={false} href="/sources" className="text-ink hover:underline">
          Sources
        </Link>
        <Link href="/about" className="text-ink hover:underline">
          About
        </Link>
      </nav>
      <span className="text-ink-soft md:text-right">Public data, cited at source</span>
    </footer>
  );
}

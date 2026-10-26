import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Read-page hero, from the dealt "control that reads the page" blueprint: two halves split by
 * tone alone; the left holds a short headline, one sentence and one action, anchored low; the
 * right holds a small working fragment of the product, live, never a picture of it.
 */
export function PageHero({
  lines,
  sentence,
  action,
  fragment,
}: {
  lines: [string, string];
  sentence: ReactNode;
  action?: { href: string; label: string };
  fragment: ReactNode;
}) {
  return (
    <section className="grid min-h-[100svh] grid-cols-1 md:grid-cols-2">
      <div className="order-2 flex flex-col justify-end px-5 pt-10 pb-14 md:order-1 md:px-10 md:pt-24 md:pb-16">
        <h1 className="text-[clamp(30px,3.2vw,46px)] leading-[1.05] font-light tracking-[-0.03em] text-ink">
          <span className="mask-line">
            <span>{lines[0]}</span>
          </span>
          <span className="mask-line">
            <span>{lines[1]}</span>
          </span>
        </h1>
        <p className="fade-up mt-5 max-w-[46ch] text-[17px] leading-[1.55] text-ink-soft">{sentence}</p>
        {action && (
          <div className="fade-up mt-7">
            <Link
              href={action.href}
              className="press inline-block rounded-[6px] bg-ink px-4 py-2.5 text-[15px] font-medium text-ground"
            >
              {action.label}
            </Link>
          </div>
        )}
      </div>
      <div className="order-1 flex min-h-[58svh] items-center justify-center bg-surface px-5 pt-20 pb-8 md:order-2 md:min-h-0 md:px-10">
        <div data-ui className="w-full max-w-[460px]">
          {fragment}
        </div>
      </div>
    </section>
  );
}

/** The narrow reading column; its left edge sits at ~22% of the viewport on wide screens. */
export function Column({ children }: { children: ReactNode }) {
  return <div className="mx-5 max-w-[560px] md:mx-0 md:ml-[max(40px,22vw)]">{children}</div>;
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-[120px] scroll-mt-20">
      <h2 className="text-[clamp(24px,2vw,30px)] leading-tight font-normal tracking-[-0.015em] text-ink">{title}</h2>
      <div className="mt-5 space-y-4 text-[17px] leading-[1.6] text-ink">{children}</div>
    </section>
  );
}

/** Two-ended row: identity on the left, a short value at the far end, nothing drawn between rows. */
export function Row({
  href,
  dot,
  label,
  value,
  sub,
}: {
  href?: string;
  dot?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
}) {
  // Phones: the value drops beneath the name (aligned with it) instead of squeezing it.
  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        {dot && <span className="mt-[5px] shrink-0">{dot}</span>}
        <span className="min-w-0">
          <span className="block text-[17px] text-ink">{label}</span>
          {sub && <span className="block text-[14px] text-ink-soft">{sub}</span>}
          {value && <span className="num block text-[14px] text-ink-soft sm:hidden">{value}</span>}
        </span>
      </span>
      {value && (
        <span className="num hidden shrink-0 pt-[2px] text-right text-[14px] text-ink-soft sm:block">{value}</span>
      )}
    </>
  );
  const cls = "flex items-start justify-between gap-6 py-2 min-h-[44px] sm:min-h-[38px]";
  return href ? (
    <Link href={href} className={`${cls} -mx-2 rounded-[6px] px-2 transition-colors duration-150 hover:bg-raised`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Country } from "@/lib/geo";
import type { CityLabel } from "@/components/globe/engine";

export interface NaturalEarth {
  borders: number[][];
  countries: Country[];
  cities: CityLabel[];
}

let pending: Promise<NaturalEarth> | null = null;

/** Self-hosted Natural Earth layers (public domain), loaded once per page. */
export function loadNaturalEarth(): Promise<NaturalEarth> {
  pending ??= Promise.all(
    ["borders", "countries", "cities"].map((name) =>
      fetch(`/data/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${name}`);
        return r.json();
      }),
    ),
  ).then(([borders, countries, cities]) => ({ borders, countries, cities }) as NaturalEarth);
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

export function useNaturalEarth() {
  const [data, setData] = useState<NaturalEarth | null>(null);
  useEffect(() => {
    let live = true;
    loadNaturalEarth()
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return data;
}

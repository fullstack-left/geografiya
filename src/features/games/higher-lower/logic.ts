/** Higher / Lower — pure logic. */
import type { Country, SourcedValue } from '@/data/types';

export type Metric = 'population' | 'gdp' | 'area' | 'elevation';
export const METRICS: Metric[] = ['population', 'area', 'gdp', 'elevation'];

export function metricValue(c: Country, m: Metric): SourcedValue<number> | null {
  switch (m) {
    case 'population':
      return c.population;
    case 'gdp':
      return c.gdp;
    case 'area':
      return c.area.value > 0 ? c.area : null;
    case 'elevation':
      return c.highestPoint?.elevation ?? null;
  }
}

/** Values closer than this are considered a tie and never paired (sources disagree by a few %). */
export const MIN_GAP = 1.05;

/**
 * Ratio band for the next challenger — the game gets harder as the streak
 * grows: obvious pairs first, close calls later.
 */
export function ratioBand(streak: number): [number, number] {
  if (streak < 4) return [2, Infinity];
  if (streak < 10) return [1.3, 4];
  return [MIN_GAP, 1.6];
}

export const ratio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);

export function eligible(countries: readonly Country[], m: Metric): Country[] {
  return countries.filter((c) => (metricValue(c, m)?.value ?? 0) > 0);
}

export function nextChallenger(
  current: Country,
  pool: readonly Country[],
  m: Metric,
  streak: number,
  used: ReadonlySet<string>,
  rng: () => number,
): Country | null {
  const v = metricValue(current, m)!.value;
  const fresh = pool.filter((c) => c.id !== current.id && !used.has(c.id));
  const ok = (lo: number, hi: number) =>
    fresh.filter((c) => {
      const r = ratio(v, metricValue(c, m)!.value);
      return r >= lo && r <= hi;
    });
  const [lo, hi] = ratioBand(streak);
  // widen the band if it's empty, but never allow near-ties
  const candidates = [ok(lo, hi), ok(MIN_GAP, Infinity)].find((l) => l.length > 0) ?? [];
  return candidates.length ? candidates[Math.floor(rng() * candidates.length)]! : null;
}

export type Guess = 'higher' | 'lower';

export function isCorrect(known: Country, challenger: Country, m: Metric, guess: Guess): boolean {
  const a = metricValue(known, m)!.value;
  const b = metricValue(challenger, m)!.value;
  return guess === 'higher' ? b > a : b < a;
}

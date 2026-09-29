/**
 * Pair selection for Area Scaler — pure & seedable.
 */
import type { Country } from '@/data/types';
import { shuffle } from '@/lib/random';
import type { Difficulty } from './scoring';

/** Well-known countries used in Easy mode (ISO alpha-3). */
export const FAMOUS = new Set([
  'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL', 'COL', 'PER', 'GBR', 'FRA', 'DEU', 'ITA', 'ESP', 'PRT',
  'POL', 'UKR', 'SWE', 'NOR', 'FIN', 'GRC', 'TUR', 'RUS', 'KAZ', 'UZB', 'CHN', 'JPN', 'KOR', 'IND',
  'PAK', 'IRN', 'SAU', 'EGY', 'NGA', 'ZAF', 'KEN', 'ETH', 'MAR', 'DZA', 'AUS', 'NZL', 'IDN', 'THA',
  'VNM', 'PHL', 'MNG', 'AFG', 'IRQ', 'ISL', 'CUB', 'VEN',
]);

export interface DifficultyConfig {
  minRatio: number;
  maxRatio: number;
  pool: (c: Country) => boolean;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { minRatio: 2, maxRatio: 5, pool: (c) => FAMOUS.has(c.id) },
  medium: {
    minRatio: 1.2,
    maxRatio: 10,
    pool: (c) => c.status === 'sovereign' && (c.population?.value ?? 0) >= 3_000_000,
  },
  // Any playable country large enough to have a recognisable 1:50m outline.
  hard: { minRatio: 1.05, maxRatio: 50, pool: (c) => c.area.value >= 5_000 && !FAMOUS.has(c.id) },
};

export interface Pair {
  referenceId: string;
  targetId: string;
}

/** Size ratio ≥ 1 regardless of order. */
export const sizeRatio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);

/**
 * Max relative gap between the drawn outline and the official area. Larger
 * gaps signal disputed borders in Natural Earth (Morocco drawn with most of
 * Western Sahara, Somalia without Somaliland) — such countries are skipped so
 * the game never presents a contested outline as fact.
 */
export const MAX_OUTLINE_GAP = 0.15;

export function outlineConsistent(c: Country): boolean {
  if (!c.hasGeometry || c.area.geometryKm2 == null || c.area.value <= 0) return false;
  return Math.abs(c.area.geometryKm2 - c.area.value) / c.area.value <= MAX_OUTLINE_GAP;
}

/** Area used for selection (the drawn outline when available, else official). */
const selArea = (c: Country) => c.area.geometryKm2 ?? c.area.value;

/**
 * Pick `rounds` distinct pairs whose area ratio falls in the difficulty band.
 * The target may be larger OR smaller than the reference.
 */
export function pickPairs(countries: Country[], difficulty: Difficulty, rounds: number, rng: () => number): Pair[] {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const pool = countries.filter((c) => outlineConsistent(c) && selArea(c) > 0 && cfg.pool(c));
  const used = new Set<string>();
  const pairs: Pair[] = [];

  for (const ref of shuffle(pool, rng)) {
    if (pairs.length >= rounds) break;
    if (used.has(ref.id)) continue;
    const candidates = pool.filter((t) => {
      if (t.id === ref.id || used.has(t.id)) return false;
      const r = sizeRatio(selArea(ref), selArea(t));
      return r >= cfg.minRatio && r <= cfg.maxRatio;
    });
    if (candidates.length === 0) continue;
    const target = candidates[Math.floor(rng() * candidates.length)]!;
    used.add(ref.id).add(target.id);
    pairs.push({ referenceId: ref.id, targetId: target.id });
  }
  return pairs;
}

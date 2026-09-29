/** Rivers, Peaks, Lakes — ranking game, pure logic. */
import type { GeoFeature } from '@/data/types';
import { shuffle } from '@/lib/random';

export type Category = 'rivers' | 'mountains' | 'lakeDepth' | 'lakeArea';
export const CATEGORIES: Category[] = ['rivers', 'mountains', 'lakeDepth', 'lakeArea'];

export const ITEMS_PER_ROUND = 4;
export const ROUNDS = 5;
/** Adjacent items must differ by ≥ 8 %, beyond disagreement between sources. */
export const MIN_STEP = 1.08;

export function categoryValue(f: GeoFeature, c: Category): number | null {
  switch (c) {
    case 'rivers':
      return f.kind === 'river' ? f.value.value : null;
    case 'mountains':
      return f.kind === 'mountain' ? f.value.value : null;
    case 'lakeDepth':
      return f.kind === 'lake' ? f.value.value : null;
    case 'lakeArea':
      return f.kind === 'lake' ? (f.area?.value ?? null) : null;
  }
}

/** Pick `n` features whose values are pairwise separated by MIN_STEP. */
export function pickRound(features: readonly GeoFeature[], c: Category, rng: () => number, n = ITEMS_PER_ROUND, avoid: ReadonlySet<string> = new Set()): GeoFeature[] {
  const pool = shuffle(
    features.filter((f) => categoryValue(f, c) !== null && !avoid.has(f.id)),
    rng,
  );
  const picked: GeoFeature[] = [];
  for (const f of pool) {
    const v = categoryValue(f, c)!;
    if (picked.every((p) => Math.max(v, categoryValue(p, c)!) / Math.min(v, categoryValue(p, c)!) >= MIN_STEP)) picked.push(f);
    if (picked.length === n) break;
  }
  return picked;
}

/** Correct order: largest first. */
export function correctOrder(items: readonly GeoFeature[], c: Category): string[] {
  return [...items].sort((a, b) => categoryValue(b, c)! - categoryValue(a, c)!).map((f) => f.id);
}

/**
 * Score = share of correctly ordered pairs (Kendall-style), 0–100. Swapping
 * two neighbours costs less than reversing the list.
 */
export function rankingScore(guess: readonly string[], truth: readonly string[]): number {
  const pos = new Map(truth.map((id, i) => [id, i]));
  let ok = 0;
  let total = 0;
  for (let i = 0; i < guess.length; i++) {
    for (let j = i + 1; j < guess.length; j++) {
      total++;
      if (pos.get(guess[i]!)! < pos.get(guess[j]!)!) ok++;
    }
  }
  return total ? Math.round((ok / total) * 100) : 0;
}

export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const a = [...list];
  if (to < 0 || to >= a.length) return a;
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x!);
  return a;
}

/** Daily Challenge — deterministic question set per UTC day. */
import type { Country } from '@/data/types';
import { mulberry32, shuffle } from '@/lib/random';
import { buildQuestions, capitalSpecs, flagSpecs, shapeSpec, type ChoiceQuestion } from '../quiz/engine';
import { outlineConsistent } from '../area-scaler/pairs';

/** YYYY-MM-DD in UTC, so everyone worldwide shares the same day boundary. */
export const dateKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);

/** FNV-1a 32-bit hash → PRNG seed. */
export function seedFrom(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The daily set ignores personal settings (territories, SRS) so every player
 * gets identical questions: only sovereign states, fixed mix of 10.
 */
export function buildDaily(allCountries: readonly Country[], key: string): ChoiceQuestion[] {
  const pool = allCountries.filter((c) => c.status === 'sovereign').sort((a, b) => a.id.localeCompare(b.id));
  const rng = mulberry32(seedFrom(`geomaster:${key}`));
  const qs = [
    ...buildQuestions(pool, capitalSpecs.countryToCapital, { count: 3, rng }),
    ...buildQuestions(pool, flagSpecs.flagToCountry, { count: 3, rng }),
    ...buildQuestions(pool, capitalSpecs.capitalToCountry, { count: 2, rng }),
    ...buildQuestions(pool, { ...shapeSpec((c) => outlineConsistent(c) && c.area.value >= 60_000), distractorPool: (c) => c.hasGeometry }, { count: 2, rng }),
  ];
  // de-duplicate answer countries across sections
  const seen = new Set<string>();
  const unique = qs.filter((q) => {
    const id = q.options[q.answer]!;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return shuffle(unique, rng).map((q) => ({ ...q, deck: 'daily' }));
}

export function shareGrid(results: boolean[]): string {
  return results.map((r) => (r ? '🟩' : '🟥')).join('');
}

export function shareText(key: string, correct: number, total: number, score: number, grid: string): string {
  return `GeoMaster ${key} — ${correct}/${total} · ${score}\n${grid}`;
}

/** ms until the next UTC midnight. */
export function msUntilNext(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

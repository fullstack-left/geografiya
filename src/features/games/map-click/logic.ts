/** "Point on the map" — pure logic. */
import { geoCentroid, geoDistance } from 'd3-geo';
import type { Country } from '@/data/types';
import type { WorldTopology } from '@/data/queries';
import { EARTH_RADIUS_KM, getCountryFeature, mainlandFeature } from '@/lib/geo/geometry';
import { weightedSample } from '@/lib/srs';

export type MapDifficulty = 'easy' | 'medium' | 'hard';
export const ROUNDS = 10;
export const ROUND_MS = 20_000;

/** Minimum official area per difficulty — tiny states are unclickable at world scale. */
export const MIN_AREA: Record<MapDifficulty, number> = { easy: 300_000, medium: 40_000, hard: 500 };

export function pickTargets(
  countries: readonly Country[],
  d: MapDifficulty,
  rng: () => number,
  weight: (id: string) => number = () => 1,
  n = ROUNDS,
): string[] {
  const pool = countries.filter((c) => c.hasGeometry && c.area.value >= MIN_AREA[d]);
  return weightedSample(pool, n, (c) => weight(c.id), rng).map((c) => c.id);
}

/** Great-circle distance between the mainland centroids of two countries, km. */
export function centroidDistanceKm(world: WorldTopology, a: string, b: string): number {
  const fa = getCountryFeature(world, a);
  const fb = getCountryFeature(world, b);
  if (!fa || !fb) return NaN;
  return geoDistance(geoCentroid(mainlandFeature(fa)), geoCentroid(mainlandFeature(fb))) * EARTH_RADIUS_KM;
}

/**
 * Correct → 100 + up to 50 speed bonus. Wrong → partial credit for being
 * close: 50 at 0 km falling linearly to 0 at 2,000 km (neighbours count).
 */
export function mapPoints(correct: boolean, msLeft: number, distanceKm: number): number {
  if (correct) return 100 + Math.round(50 * Math.min(1, Math.max(0, msLeft / ROUND_MS)));
  if (!Number.isFinite(distanceKm)) return 0;
  return Math.max(0, Math.round(50 * (1 - distanceKm / 2000)));
}

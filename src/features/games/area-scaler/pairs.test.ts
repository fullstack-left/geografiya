import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CountriesFile } from '@/data/types';
import { isIncluded } from '@/data/queries';
import { mulberry32 } from '@/lib/random';
import { DIFFICULTY_CONFIG, FAMOUS, outlineConsistent, pickPairs, sizeRatio } from './pairs';
import type { Difficulty } from './scoring';
import { initialState, reducer } from './state';

const { countries: all } = JSON.parse(
  readFileSync(join(__dirname, '../../../../public/data/countries.v2.json'), 'utf8'),
) as CountriesFile;
const countries = all.filter((c) => isIncluded(c, { includeTerritories: false, includePartial: true }));
const byId = new Map(countries.map((c) => [c.id, c]));
const area = (id: string) => byId.get(id)!.area.geometryKm2 ?? byId.get(id)!.area.value;

describe('pickPairs', () => {
  it.each<Difficulty>(['easy', 'medium', 'hard'])('%s: 5 distinct pairs within the ratio band', (d) => {
    for (let seed = 1; seed <= 25; seed++) {
      const pairs = pickPairs(countries, d, 5, mulberry32(seed));
      expect(pairs).toHaveLength(5);
      const ids = pairs.flatMap((p) => [p.referenceId, p.targetId]);
      expect(new Set(ids).size).toBe(ids.length);
      const { minRatio, maxRatio, pool } = DIFFICULTY_CONFIG[d];
      for (const p of pairs) {
        const r = sizeRatio(area(p.referenceId), area(p.targetId));
        expect(r).toBeGreaterThanOrEqual(minRatio);
        expect(r).toBeLessThanOrEqual(maxRatio);
        expect(pool(byId.get(p.referenceId)!)).toBe(true);
        expect(byId.get(p.targetId)!.hasGeometry).toBe(true);
      }
    }
  });

  it('easy mode only uses famous countries', () => {
    const pairs = pickPairs(countries, 'easy', 5, mulberry32(42));
    for (const p of pairs) {
      expect(FAMOUS.has(p.referenceId)).toBe(true);
      expect(FAMOUS.has(p.targetId)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(pickPairs(countries, 'medium', 5, mulberry32(7))).toEqual(pickPairs(countries, 'medium', 5, mulberry32(7)));
  });

  it('targets are sometimes smaller than the reference', () => {
    const smaller = Array.from({ length: 20 }, (_, s) => pickPairs(countries, 'easy', 5, mulberry32(s)))
      .flat()
      .filter((p) => area(p.targetId) < area(p.referenceId));
    expect(smaller.length).toBeGreaterThan(0);
  });

  it('respects territory settings', () => {
    const pairs = Array.from({ length: 20 }, (_, s) => pickPairs(countries, 'hard', 5, mulberry32(s))).flat();
    for (const p of pairs) {
      expect(byId.get(p.referenceId)!.status).not.toBe('territory');
      expect(byId.get(p.targetId)!.status).not.toBe('territory');
    }
  });

  it('never uses countries with contested / inconsistent outlines', () => {
    for (const id of ['MAR', 'SOM', 'ESH']) expect(outlineConsistent(all.find((c) => c.id === id)!)).toBe(false);
    const ids = (['easy', 'medium', 'hard'] as const)
      .flatMap((d) => Array.from({ length: 30 }, (_, s) => pickPairs(countries, d, 5, mulberry32(s))).flat())
      .flatMap((p) => [p.referenceId, p.targetId]);
    for (const id of ids) expect(outlineConsistent(byId.get(id)!), id).toBe(true);
  });

  it('returns [] for an empty pool', () => {
    expect(pickPairs([], 'easy', 5, mulberry32(1))).toEqual([]);
  });
});

describe('game reducer', () => {
  const pairs = [
    { referenceId: 'FRA', targetId: 'ESP' },
    { referenceId: 'UZB', targetId: 'KAZ' },
  ];

  it('plays a full game', () => {
    let s = reducer(initialState, { type: 'start', difficulty: 'medium', pairs });
    expect(s.phase).toBe('playing');
    s = reducer(s, { type: 'setRatio', ratio: 0.9 });
    s = reducer(s, { type: 'confirm', trueRatio: 0.9 });
    expect(s.phase).toBe('revealed');
    expect(s.results[0]).toMatchObject({ accuracy: 100, points: 150 });
    // ratio cannot change after confirming
    expect(reducer(s, { type: 'setRatio', ratio: 3 }).userRatio).toBe(0.9);
    s = reducer(s, { type: 'next' });
    expect(s).toMatchObject({ phase: 'playing', round: 1, userRatio: 1 });
    s = reducer(s, { type: 'scaleBy', factor: 2 });
    s = reducer(s, { type: 'scaleBy', factor: 2 });
    expect(s.userRatio).toBe(4);
    s = reducer(s, { type: 'confirm', trueRatio: 6 });
    s = reducer(s, { type: 'next' });
    expect(s.phase).toBe('summary');
    expect(s.results).toHaveLength(2);
  });

  it('ignores start with no pairs and double confirms', () => {
    expect(reducer(initialState, { type: 'start', difficulty: 'easy', pairs: [] })).toBe(initialState);
    let s = reducer(initialState, { type: 'start', difficulty: 'easy', pairs });
    s = reducer(s, { type: 'confirm', trueRatio: 1 });
    expect(reducer(s, { type: 'confirm', trueRatio: 1 }).results).toHaveLength(1);
  });

  it('clamps the ratio', () => {
    let s = reducer(initialState, { type: 'start', difficulty: 'easy', pairs });
    s = reducer(s, { type: 'setRatio', ratio: 1e6 });
    expect(s.userRatio).toBe(80);
  });
});

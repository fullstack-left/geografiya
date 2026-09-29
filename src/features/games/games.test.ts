import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/lib/random';
import { allCountries, byId, countries, features, world } from '@/test/fixtures';
import { MIN_AREA, centroidDistanceKm, mapPoints, pickTargets, ROUND_MS } from './map-click/logic';
import { MIN_GAP, eligible, isCorrect, metricValue, nextChallenger, ratio, ratioBand } from './higher-lower/logic';
import { buildGraph, chainScore, distances, hint, HOPS, pickPuzzles, shortestPath, step } from './borders/logic';
import { CATEGORIES, MIN_STEP, categoryValue, correctOrder, move, pickRound, rankingScore } from './features/logic';
import { buildDaily, dateKey, msUntilNext, seedFrom, shareGrid } from './daily/logic';

describe('map-click', () => {
  it('picks distinct, clickable-size targets', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const t = pickTargets(countries, d, mulberry32(4));
      expect(new Set(t).size).toBe(10);
      for (const id of t) expect(byId.get(id)!.area.value).toBeGreaterThanOrEqual(MIN_AREA[d]);
    }
  });
  it('computes centroid distances (Tashkent-ish ↔ Almaty-ish scale)', () => {
    const km = centroidDistanceKm(world, 'UZB', 'KAZ');
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(2000);
    expect(centroidDistanceKm(world, 'FRA', 'FRA')).toBeCloseTo(0);
  });
  it('scores hits and near misses', () => {
    expect(mapPoints(true, ROUND_MS, 0)).toBe(150);
    expect(mapPoints(false, ROUND_MS, 0)).toBe(50);
    expect(mapPoints(false, 0, 1000)).toBe(25);
    expect(mapPoints(false, 0, 5000)).toBe(0);
    expect(mapPoints(false, 0, NaN)).toBe(0);
  });
});

describe('higher-lower', () => {
  it('never pairs near-ties and follows the difficulty band', () => {
    for (const m of ['population', 'area', 'gdp', 'elevation'] as const) {
      const pool = eligible(countries, m);
      const rng = mulberry32(11);
      let cur = pool[0]!;
      const used = new Set([cur.id]);
      for (let streak = 0; streak < 30; streak++) {
        const nx = nextChallenger(cur, pool, m, streak, used, rng);
        if (!nx) break;
        const r = ratio(metricValue(cur, m)!.value, metricValue(nx, m)!.value);
        expect(r).toBeGreaterThanOrEqual(MIN_GAP);
        used.add(nx.id);
        cur = nx;
      }
    }
  });
  it('gets harder as the streak grows', () => {
    expect(ratioBand(0)[0]).toBeGreaterThan(ratioBand(20)[0]);
  });
  it('judges guesses', () => {
    const [chn, uzb] = [byId.get('CHN')!, byId.get('UZB')!];
    expect(isCorrect(uzb, chn, 'population', 'higher')).toBe(true);
    expect(isCorrect(uzb, chn, 'population', 'lower')).toBe(false);
    expect(isCorrect(chn, uzb, 'elevation', 'lower')).toBe(true);
  });
});

describe('borders', () => {
  const g = buildGraph(countries);
  it('is symmetric and drops non-land borders', () => {
    for (const [a, ns] of g) for (const b of ns) expect(g.get(b)!.has(a)).toBe(true);
    expect(g.get('LKA')?.has('IND') ?? false).toBe(false);
    expect(g.get('UZB')).toEqual(new Set(['AFG', 'KAZ', 'KGZ', 'TJK', 'TKM']));
  });
  it('finds shortest paths', () => {
    expect(shortestPath(g, 'UZB', 'UZB')).toEqual(['UZB']);
    expect(shortestPath(g, 'FRA', 'DEU')).toEqual(['FRA', 'DEU']);
    expect(distances(g, 'PRT').get('POL')).toBe(4); // PRT→ESP→FRA→DEU→POL
    expect(shortestPath(g, 'GBR', 'FRA')).toBeNull(); // no land link (Channel Tunnel isn't a border)
  });
  it('makes puzzles in the hop band', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const ps = pickPuzzles(g, d, 5, mulberry32(2));
      expect(ps).toHaveLength(5);
      for (const p of ps) {
        expect(p.optimal).toBeGreaterThanOrEqual(HOPS[d][0]);
        expect(p.optimal).toBeLessThanOrEqual(HOPS[d][1]);
        expect(distances(g, p.start).get(p.target)).toBe(p.optimal);
      }
    }
  });
  it('validates steps and hints', () => {
    expect(step(g, ['UZB'], 'TUR', 'KAZ')).toBe('ok');
    expect(step(g, ['UZB'], 'TUR', 'RUS')).toBe('not-neighbour');
    expect(step(g, ['UZB', 'KAZ'], 'TUR', 'UZB')).toBe('already-used');
    expect(step(g, ['UZB'], 'KAZ', 'KAZ')).toBe('reached');
    expect(step(g, ['UZB'], 'KAZ', 'ZZZ')).toBe('unknown');
    const h = hint(g, ['UZB'], 'RUS');
    expect(h).toBe('KAZ');
  });
  it('scores routes', () => {
    expect(chainScore(3, 3, 0, 0)).toBe(100);
    expect(chainScore(3, 5, 1, 1)).toBe(35);
    expect(chainScore(2, 20, 5, 5)).toBe(0);
  });
});

describe('features', () => {
  const f = (en: string) => features.find((x) => x.name.en.includes(en))!;
  it('data: key facts are right', () => {
    expect(f('Everest').value.value).toBe(8849);
    expect(f('Nile').value.value).toBeGreaterThan(f('Amazon').value.value);
    expect(f('Baikal').value.value).toBe(1642);
    expect(f('Caspian').area!.value).toBeGreaterThan(350_000);
    for (const x of features) expect(x.value.value).toBeGreaterThan(0);
  });
  it('rounds are separated by MIN_STEP', () => {
    for (const c of CATEGORIES) {
      for (let s = 0; s < 30; s++) {
        const items = pickRound(features, c, mulberry32(s));
        expect(items).toHaveLength(4);
        const v = items.map((x) => categoryValue(x, c)!).sort((a, b) => a - b);
        for (let i = 1; i < v.length; i++) expect(v[i]! / v[i - 1]!).toBeGreaterThanOrEqual(MIN_STEP);
      }
    }
  });
  it('scores orderings by correct pairs', () => {
    const t = ['a', 'b', 'c', 'd'];
    expect(rankingScore(t, t)).toBe(100);
    expect(rankingScore([...t].reverse(), t)).toBe(0);
    expect(rankingScore(['b', 'a', 'c', 'd'], t)).toBe(83);
    expect(move(t, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(move(t, 0, -1)).toEqual(t);
  });
  it('orders largest first', () => {
    const items = [f('Thames'), f('Nile'), f('Danube')];
    expect(correctOrder(items, 'rivers').map((id) => features.find((x) => x.id === id)!.name.en)).toEqual([
      f('Nile').name.en,
      f('Danube').name.en,
      f('Thames').name.en,
    ]);
  });
});

describe('daily', () => {
  it('is deterministic per day and independent of settings', () => {
    const a = buildDaily(allCountries, '2026-09-29');
    const b = buildDaily([...allCountries].reverse(), '2026-09-29');
    const c = buildDaily(allCountries, '2026-09-30');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(10);
    const answers = a.map((q) => q.options[q.answer]);
    expect(new Set(answers).size).toBe(a.length);
    for (const id of answers) expect(byId.get(id!)!.status).toBe('sovereign');
  });
  it('helpers', () => {
    expect(dateKey(new Date('2026-09-29T23:59:00Z'))).toBe('2026-09-29');
    expect(seedFrom('a')).not.toBe(seedFrom('b'));
    expect(shareGrid([true, false])).toBe('🟩🟥');
    expect(msUntilNext(new Date('2026-09-29T23:00:00Z'))).toBe(3_600_000);
  });
});

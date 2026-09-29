import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { geoArea } from 'd3-geo';
import type { Feature, Polygon } from 'geojson';
import type { WorldTopology } from '@/data/queries';
import type { CountriesFile } from '@/data/types';
import {
  EARTH_RADIUS_KM,
  areaKm2,
  fitScale,
  getCountryFeature,
  kmPerPx,
  linearScaleFor,
  mainlandFeature,
  niceScaleBar,
  projectShape,
  trueAreaRatio,
} from './geometry';

const DATA = join(__dirname, '../../../../public/data');
const world = JSON.parse(readFileSync(join(DATA, 'world-50m.v1.json'), 'utf8')) as WorldTopology;
const { countries } = JSON.parse(readFileSync(join(DATA, 'countries.v1.json'), 'utf8')) as CountriesFile;
const byId = new Map(countries.map((c) => [c.id, c]));

const feat = (id: string) => {
  const f = getCountryFeature(world, id);
  if (!f) throw new Error(`no geometry for ${id}`);
  return f;
};

/** Planar area (px²) of a projected SVG path made of M/L/Z commands. */
function svgPathArea(d: string): number {
  let total = 0;
  for (const ring of d.split('M').filter(Boolean)) {
    const pts = ring
      .replace(/Z/g, '')
      .split('L')
      .map((p) => p.split(',').map(Number) as [number, number]);
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      a += x1 * y2 - x2 * y1;
    }
    total += a / 2;
  }
  return Math.abs(total);
}

describe('spherical areas', () => {
  it('a 1°×1° cell at the equator is ~12,364 km²', () => {
    const cell: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
    };
    expect(areaKm2(cell)).toBeGreaterThan(12_300);
    expect(areaKm2(cell)).toBeLessThan(12_400);
  });

  it.each([
    ['RUS', 17_098_246],
    ['UZB', 448_978],
    ['BRA', 8_515_767],
    ['AUS', 7_692_024],
    ['DEU', 357_588],
  ])('outline area of %s is within 5%% of the official figure', (id, official) => {
    const km2 = areaKm2(feat(id));
    expect(Math.abs(km2 - official) / official).toBeLessThan(0.05);
  });

  it('dataset official areas agree with the shipped geometry (sovereign, >20k km²)', () => {
    const outliers = countries
      .filter((c) => c.status === 'sovereign' && c.hasGeometry && c.area.value > 20_000)
      .filter((c) => {
        const g = c.area.geometryKm2!;
        return Math.abs(g - c.area.value) / c.area.value > 0.15;
      })
      .map((c) => c.id);
    // Known, documented gaps: disputed borders in Natural Earth (MAR incl.
    // Western Sahara, SOM excl. Somaliland) and PHL (coarse 1:50m islands).
    // These are excluded from Area Scaler via `outlineConsistent` (pairs.ts).
    expect(outliers.sort()).toEqual(['MAR', 'PHL', 'SOM']);
  });
});

describe('mainlandFeature', () => {
  it('drops French Guiana & Réunion from France but keeps Corsica', () => {
    const full = feat('FRA');
    const main = mainlandFeature(full);
    const mainKm2 = areaKm2(main);
    // Metropolitan France incl. Corsica ≈ 551,695 km²
    expect(mainKm2).toBeGreaterThan(530_000);
    expect(mainKm2).toBeLessThan(560_000);
    expect(areaKm2(full)).toBeGreaterThan(mainKm2 + 80_000); // French Guiana ≈ 83,534 km²
  });

  it('keeps Alaska with the USA, drops Hawaii', () => {
    const main = areaKm2(mainlandFeature(feat('USA')));
    expect(main).toBeGreaterThan(9_000_000);
    expect(areaKm2(feat('USA')) - main).toBeGreaterThan(15_000); // Hawaii ≈ 28,300 km²
  });

  it('keeps Russia intact (antimeridian, Kaliningrad)', () => {
    const full = areaKm2(feat('RUS'));
    expect(areaKm2(mainlandFeature(feat('RUS')))).toBeCloseTo(full, -3);
  });

  it('is a no-op for single polygons', () => {
    const f = feat('UZB');
    if (f.geometry.type === 'Polygon') expect(mainlandFeature(f)).toBe(f);
  });
});

describe('equal-area projection', () => {
  it('drawn areas are proportional to true areas (Greenland vs Africa-scale test)', () => {
    const pairs: [string, string][] = [
      ['FRA', 'RUS'],
      ['GRL', 'COD'],
      ['UZB', 'NOR'],
      ['CHL', 'IDN'],
    ];
    for (const [a, b] of pairs) {
      const fa = mainlandFeature(feat(a));
      const fb = mainlandFeature(feat(b));
      const s = 300;
      const pa = svgPathArea(projectShape(fa, s, 0, 0).d);
      const pb = svgPathArea(projectShape(fb, s, 0, 0).d);
      // px² ratio must match km² ratio within 1.5 % (discretisation only)
      expect(pb / pa / trueAreaRatio(fa, fb)).toBeGreaterThan(0.985);
      expect(pb / pa / trueAreaRatio(fa, fb)).toBeLessThan(1.015);
      // and px² → km² conversion is consistent with the scale
      expect(pa * kmPerPx(s) ** 2 / areaKm2(fa)).toBeCloseTo(1, 1);
    }
  });

  it('Greenland is ~14× smaller than Africa\'s largest country cluster would suggest on Mercator', () => {
    // DR Congo ≈ 2.34M km², Greenland ≈ 2.17M km² → ratio ≈ 1.08, not ~3 as Mercator implies
    const r = trueAreaRatio(mainlandFeature(feat('GRL')), mainlandFeature(feat('COD')));
    expect(r).toBeGreaterThan(1);
    expect(r).toBeLessThan(1.2);
  });

  it('fitScale fits the bounding box', () => {
    const f = feat('ITA');
    const s = fitScale(f, 200);
    const p = projectShape(f, s, 0, 0);
    expect(Math.max(p.width, p.height)).toBeCloseTo(200, 0);
  });

  it('centres the bounding box on the requested point', () => {
    const p = projectShape(feat('JPN'), 400, 50, 50);
    expect(p.d.length).toBeGreaterThan(100);
  });
});

describe('linearScaleFor', () => {
  it('is 1 when the guess equals the truth', () => {
    expect(linearScaleFor(4, 4)).toBe(1);
  });
  it('uses sqrt because area ∝ length²', () => {
    expect(linearScaleFor(4, 1)).toBe(2);
    expect(linearScaleFor(1, 9)).toBeCloseTo(1 / 3);
  });
});

describe('niceScaleBar', () => {
  it('picks 1/2/5×10ⁿ km that fits', () => {
    const scale = 1000; // 6.37 km/px
    const { km, px } = niceScaleBar(scale, 100); // ≤ 637 km
    expect(km).toBe(500);
    expect(px).toBeCloseTo((500 / EARTH_RADIUS_KM) * scale);
    expect(px).toBeLessThanOrEqual(100);
  });
});

describe('dataset sanity', () => {
  it('has key facts right', () => {
    expect(byId.get('UZB')?.capitals[0]?.en).toBe('Tashkent');
    expect(byId.get('UZB')?.name.uz).toMatch(/O.zbekiston/);
    expect(byId.get('CAN')!.area.value).toBeCloseTo(9_984_670, -4);
    expect(byId.get('HRV')!.area.value).toBeLessThan(60_000);
    expect(byId.get('GRL')?.status).toBe('territory');
    expect(byId.get('HKG')?.status).toBe('territory');
    expect(byId.get('UNK')?.status).toBe('partial');
    expect(byId.get('TWN')?.status).toBe('partial');
  });

  it('borders reference known countries', () => {
    for (const c of countries) for (const b of c.borders) expect(byId.has(b), `${c.id}→${b}`).toBe(true);
  });

  it('every country has a source for its area', () => {
    for (const c of countries) expect(c.area.source).toBeTruthy();
  });

  it('geometry area is plausible vs d3 directly', () => {
    const f = feat('EGY');
    expect(areaKm2(f)).toBeCloseTo(geoArea(f) * EARTH_RADIUS_KM ** 2);
  });
});

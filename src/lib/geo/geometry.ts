/**
 * Pure geometry helpers for the Area Scaler game.
 *
 * Why equal-area? Mercator inflates areas towards the poles (Greenland looks
 * as big as Africa, while Africa is ~14× larger). We draw every country with a
 * Lambert azimuthal EQUAL-AREA projection centred on the country itself: area
 * is preserved exactly and shape distortion is minimal near the centre, so two
 * shapes drawn with the same scale can be compared fairly.
 */
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import type { WorldTopology } from '@/data/queries';

export const EARTH_RADIUS_KM = 6371.0088;

export type CountryFeature = Feature<Polygon | MultiPolygon>;

export function getCountryFeature(world: WorldTopology, id: string): CountryFeature | null {
  const geom = world.objects.countries.geometries.find((g) => g.id === id);
  if (!geom) return null;
  const f = feature(world, geom) as Feature;
  if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') return null;
  return f as CountryFeature;
}

/** Spherical area in km². */
export const areaKm2 = (f: Feature) => geoArea(f) * EARTH_RADIUS_KM ** 2;

/** Max angular distance (radians) from the main landmass for a part to be kept. */
const MAX_PART_DISTANCE = (45 * Math.PI) / 180;

/**
 * Keep only the parts of a country that belong to its main landmass region:
 * drops remote overseas territories (French Guiana/Réunion for France,
 * Hawaii for the USA) that would otherwise be drawn thousands of km away and
 * make the shape unrecognisable. Alaska, Kaliningrad, Corsica, Svalbard stay.
 */
export function mainlandFeature(f: CountryFeature): CountryFeature {
  if (f.geometry.type === 'Polygon') return f;
  const parts = f.geometry.coordinates.map((coords) => {
    const p: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords } };
    return { coords, area: geoArea(p), centroid: geoCentroid(p) };
  });
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const kept = parts.filter((p) => geoDistance(p.centroid, main.centroid) <= MAX_PART_DISTANCE);
  return {
    ...f,
    geometry: { type: 'MultiPolygon', coordinates: kept.map((p) => p.coords) as Position[][][] },
  };
}

/** Ratio of the drawn shapes' true areas: target / reference. */
export function trueAreaRatio(reference: Feature, target: Feature): number {
  return areaKm2(target) / areaKm2(reference);
}

/**
 * Linear (length) scale factor the target must be drawn with, relative to the
 * shared "true" scale, so that its on-screen area equals `userRatio` × the
 * reference's on-screen area. Area scales with the square of length.
 */
export function linearScaleFor(userRatio: number, trueRatio: number): number {
  return Math.sqrt(userRatio / trueRatio);
}

export interface ProjectedShape {
  d: string;
  /** Bounding box width/height in px at the given scale. */
  width: number;
  height: number;
}

/**
 * Project a feature with an equal-area projection centred on itself, at
 * `scale` px per Earth radius, with its bounding box centred at (cx, cy).
 */
export function projectShape(f: Feature, scale: number, cx: number, cy: number): ProjectedShape {
  const [lon, lat] = geoCentroid(f);
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .scale(scale)
    .translate([0, 0])
    .clipAngle(179.9)
    .precision(0.2);
  const path = geoPath(projection);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  projection.translate([cx - (x0 + x1) / 2, cy - (y0 + y1) / 2]);
  return { d: path(f) ?? '', width: x1 - x0, height: y1 - y0 };
}

/** Size of the shape's bounding box at scale = 1 (unit sphere). */
export function unitExtent(f: Feature): { width: number; height: number } {
  const s = projectShape(f, 1, 0, 0);
  return { width: s.width, height: s.height };
}

/**
 * Scale (px per Earth radius) that fits the bbox of `f` into a box of
 * `boxPx` × `boxPx`.
 */
export function fitScale(f: Feature, boxPx: number): number {
  const { width, height } = unitExtent(f);
  return boxPx / Math.max(width, height, 1e-9);
}

/** Kilometres represented by one pixel at the projection centre. */
export const kmPerPx = (scale: number) => EARTH_RADIUS_KM / scale;

/** A "nice" scale-bar length (1, 2, 5 × 10ⁿ km) that fits within maxPx. */
export function niceScaleBar(scale: number, maxPx: number): { km: number; px: number } {
  const maxKm = kmPerPx(scale) * maxPx;
  const pow = 10 ** Math.floor(Math.log10(maxKm));
  const km = [5, 2, 1].map((m) => m * pow).find((v) => v <= maxKm) ?? pow;
  return { km, px: km / kmPerPx(scale) };
}

/**
 * Shared data contracts between `scripts/fetch-geo-data.ts` (producer)
 * and the app (consumer). Bump DATA_VERSION when the shape changes.
 */
export const DATA_VERSION = 1;

export type Locale = 'uz' | 'ru' | 'en';
export type LocalizedText = Record<Locale, string>;

/**
 * sovereign – UN member states (+ Vatican, UN observer state)
 * partial   – partially recognised / disputed (Kosovo, Taiwan, Palestine, W. Sahara)
 * territory – dependent territories & constituent parts (Greenland, Hong Kong, …)
 */
export type CountryStatus = 'sovereign' | 'partial' | 'territory';

export interface SourcedValue<T> {
  value: T;
  source: SourceId;
  /** Year the value refers to (if the source reports it). */
  year?: number;
}

export interface AreaRecord extends SourcedValue<number> {
  /** Other sources' values, kept for transparency. */
  alternates: SourcedValue<number>[];
  /** Max relative difference between sources, in percent. */
  discrepancyPct: number;
  /** Area of the polygon geometry we ship (spherical, km²). */
  geometryKm2: number | null;
}

export type SourceId = 'worldbank' | 'mledoze-countries' | 'wikidata' | 'natural-earth';

export interface Country {
  /** ISO 3166-1 alpha-3 (Kosovo uses the `UNK` user-assigned code). */
  id: string;
  cca2: string;
  ccn3: string | null;
  name: LocalizedText;
  officialName: string;
  capitals: LocalizedText[];
  region: string;
  subregion: string;
  status: CountryStatus;
  /** Free-text note for disputed/special cases (English). */
  statusNote?: string;
  area: AreaRecord;
  population: SourcedValue<number> | null;
  borders: string[];
  landlocked: boolean;
  latlng: [number, number];
  flagSvg: string;
  flagEmoji: string;
  /** True when a polygon with id === this.id exists in the world topology. */
  hasGeometry: boolean;
}

export interface SourceInfo {
  id: SourceId;
  name: string;
  url: string;
  license: string;
  fetchedAt: string;
  /** Upstream "last updated" stamp when the API exposes one. */
  upstreamUpdated?: string;
}

export interface DataManifest {
  version: number;
  generatedAt: string;
  files: { countries: string; world: string };
  sources: SourceInfo[];
  stats: { countries: number; withGeometry: number; withPopulation: number; areaDiscrepancies: number };
  warnings: string[];
}

export interface CountriesFile {
  version: number;
  generatedAt: string;
  countries: Country[];
}

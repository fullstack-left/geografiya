import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CountriesFile, FeaturesFile } from '@/data/types';
import { DATA_VERSION } from '@/data/types';
import { isIncluded } from '@/data/queries';
import type { WorldTopology } from '@/data/queries';

const DATA = join(__dirname, '../../public/data');
const load = <T>(f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8')) as T;

export const allCountries = load<CountriesFile>(`countries.v${DATA_VERSION}.json`).countries;
/** Default settings: no territories, partially recognised on. */
export const countries = allCountries.filter((c) => isIncluded(c, { includeTerritories: false, includePartial: true }));
export const byId = new Map(allCountries.map((c) => [c.id, c]));
export const features = load<FeaturesFile>(`features.v${DATA_VERSION}.json`).features;
export const world = load<WorldTopology>(`world-50m.v${DATA_VERSION}.json`);

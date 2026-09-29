import { useQuery } from '@tanstack/react-query';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { CountriesFile, Country, DataManifest } from './types';
import { DATA_VERSION } from './types';
import { useSettings } from '@/stores/settings';

export type WorldTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

// Static, versioned files → cache forever for the session.
const staticOpts = { staleTime: Infinity, gcTime: Infinity, retry: 2 } as const;

export const useManifest = () =>
  useQuery({ queryKey: ['manifest'], queryFn: () => getJson<DataManifest>('manifest.json'), ...staticOpts });

export const useCountries = () =>
  useQuery({
    queryKey: ['countries', DATA_VERSION],
    queryFn: () => getJson<CountriesFile>(`countries.v${DATA_VERSION}.json`),
    select: (f) => f.countries,
    ...staticOpts,
  });

export const useWorld = () =>
  useQuery({
    queryKey: ['world', DATA_VERSION],
    queryFn: () => getJson<WorldTopology>(`world-50m.v${DATA_VERSION}.json`),
    ...staticOpts,
  });

export interface InclusionFilter {
  includeTerritories: boolean;
  includePartial: boolean;
}

export function isIncluded(c: Country, f: InclusionFilter): boolean {
  if (c.status === 'territory') return f.includeTerritories;
  if (c.status === 'partial') return f.includePartial;
  return true;
}

/** Countries allowed by the user's settings. */
export function usePlayableCountries() {
  const includeTerritories = useSettings((s) => s.includeTerritories);
  const includePartial = useSettings((s) => s.includePartial);
  const q = useCountries();
  const data = q.data?.filter((c) => isIncluded(c, { includeTerritories, includePartial }));
  return { ...q, data };
}

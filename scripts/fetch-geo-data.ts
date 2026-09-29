/**
 * GeoMaster data pipeline.
 *
 *   npm run data:fetch            # uses cache in scripts/.cache when present
 *   npm run data:fetch -- --fresh # ignore cache, re-download everything
 *
 * Downloads static geographic data ONCE from trusted sources, reconciles it,
 * and writes versioned JSON into public/data/. The app never calls these APIs
 * at runtime.
 *
 * Sources
 *  - mledoze/countries  – the open dataset REST Countries is built from
 *                         (REST Countries v1–v4 were shut down in 2026 and v5
 *                         requires an API key; the underlying data is identical).
 *  - World Bank API     – surface area (AG.SRF.TOTL.K2) and population (SP.POP.TOTL).
 *  - Wikidata SPARQL    – Uzbek / Russian names of countries and capitals, area (P2046).
 *
 * Area reconciliation (see `reconcileArea`): the official World Bank value wins
 * whenever at least one independent source confirms it (±2%). Since 2020 the
 * AG.SRF.TOTL.K2 series contains values that include territorial waters for
 * some countries (e.g. Canada 15.6M km², Croatia 88k km²), so an unconfirmed
 * World Bank value is NOT trusted blindly: the value on which the other sources
 * agree is used instead, otherwise the median. Every decision is logged in
 * manifest.json → warnings.
 *  - world-atlas (Natural Earth 1:50m) – TopoJSON country polygons.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import {
  DATA_VERSION,
  type AreaRecord,
  type CountriesFile,
  type Country,
  type CountryStatus,
  type DataManifest,
  type LocalizedText,
  type SourceInfo,
  type SourcedValue,
} from '../src/data/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', '.cache');
const OUT = join(ROOT, 'public', 'data');
const FRESH = process.argv.includes('--fresh');
const EARTH_RADIUS_KM = 6371.0088;
const DISCREPANCY_WARN_PCT = 2;
/** Sources agreeing within this tolerance are considered to confirm each other. */
const AGREE_PCT = 2;

const URLS = {
  countries: 'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json',
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
  wbArea: 'https://api.worldbank.org/v2/country/all/indicator/AG.SRF.TOTL.K2?format=json&mrv=1&per_page=400',
  wbPop: 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrv=1&per_page=400',
  wikidata: 'https://query.wikidata.org/sparql',
};

/** Codes where sources disagree on identifiers. mledoze uses UNK for Kosovo. */
const WB_TO_APP: Record<string, string> = { XKX: 'UNK' };
/** world-atlas polygons without an ISO numeric id, matched by name. */
const WORLD_NAME_TO_ID: Record<string, string> = { Kosovo: 'UNK' };

const PARTIAL: Record<string, string> = {
  UNK: 'Partially recognised state; Serbia claims it as its province.',
  TWN: 'Partially recognised; claimed by the People\'s Republic of China.',
  PSE: 'UN observer state with partial recognition; borders disputed.',
  ESH: 'Disputed territory (Morocco / Sahrawi Arab Democratic Republic).',
};
/** Non-UN entities that are nevertheless fully sovereign. */
const SOVEREIGN_NON_UN = new Set(['VAT']);

// ---------------------------------------------------------------- helpers

async function fetchCached<T>(key: string, url: string, init?: RequestInit): Promise<T> {
  const file = join(CACHE, `${key}.json`);
  if (!FRESH && existsSync(file)) {
    console.log(`  · cache  ${key}`);
    return JSON.parse(await readFile(file, 'utf8')) as T;
  }
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`  ↓ fetch  ${key} (attempt ${attempt})`);
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': 'GeoMaster-data/1.0 (https://github.com/fullstack-left/geografiya)', ...init?.headers },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = (await res.json()) as T;
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, JSON.stringify(json));
      return json;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error(`Failed to fetch ${key}: ${String(lastErr)}`);
}

const relDiffPct = (a: number, b: number) => (Math.abs(a - b) / Math.max(a, b)) * 100;

/**
 * Pick the most trustworthy area value. `values` is ordered by priority
 * (World Bank first). A value is "confirmed" when another source agrees.
 */
function reconcileArea(
  values: SourcedValue<number>[],
  geometryKm2: number | undefined,
): { primary: SourcedValue<number>; reason: string } {
  if (values.length === 0) {
    return { primary: { value: geometryKm2 ?? 0, source: 'natural-earth' }, reason: 'geometry only' };
  }
  if (values.length === 1) return { primary: values[0]!, reason: 'single source' };
  for (const v of values) {
    if (values.some((o) => o !== v && relDiffPct(o.value, v.value) <= AGREE_PCT)) {
      return { primary: v, reason: 'confirmed by another source' };
    }
  }
  const sorted = [...values].sort((a, b) => a.value - b.value);
  return { primary: sorted[Math.floor((sorted.length - 1) / 2)]!, reason: 'no agreement → median' };
}

// ---------------------------------------------------------------- source types

interface MledozeCountry {
  name: { common: string; official: string };
  cca2: string;
  ccn3: string;
  cca3: string;
  independent: boolean | null;
  unMember: boolean;
  capital: string[];
  region: string;
  subregion: string;
  translations: Record<string, { common: string; official: string }>;
  latlng: [number, number];
  landlocked: boolean;
  borders: string[];
  area: number;
  flag: string;
}

type WbRow = { countryiso3code: string; date: string; value: number | null };
type WbResponse = [{ lastupdated: string; total: number }, WbRow[]];

interface SparqlRow {
  iso: { value: string };
  uz?: { value: string };
  ru?: { value: string };
  capEn?: { value: string };
  capUz?: { value: string };
  capRu?: { value: string };
}

// ---------------------------------------------------------------- main

async function main() {
  const fetchedAt = new Date().toISOString();
  console.log('GeoMaster data pipeline');

  const [raw, world, wbArea, wbPop] = await Promise.all([
    fetchCached<MledozeCountry[]>('mledoze-countries', URLS.countries),
    fetchCached<Topology<{ countries: GeometryCollection<{ name: string }> }>>('world-atlas-50m', URLS.world),
    fetchCached<WbResponse>('wb-area', URLS.wbArea),
    fetchCached<WbResponse>('wb-pop', URLS.wbPop),
  ]);

  const sparql = `
    SELECT ?iso ?uz ?ru ?capEn ?capUz ?capRu WHERE {
      ?c wdt:P298 ?iso .
      FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
      OPTIONAL { ?c rdfs:label ?uz FILTER(LANG(?uz) = "uz") }
      OPTIONAL { ?c rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
      OPTIONAL {
        ?c p:P36 ?capStmt . ?capStmt ps:P36 ?cap .
        FILTER NOT EXISTS { ?capStmt pq:P582 ?end }
        OPTIONAL { ?cap rdfs:label ?capEn FILTER(LANG(?capEn) = "en") }
        OPTIONAL { ?cap rdfs:label ?capUz FILTER(LANG(?capUz) = "uz") }
        OPTIONAL { ?cap rdfs:label ?capRu FILTER(LANG(?capRu) = "ru") }
      }
    }`;
  const wd = await fetchCached<{ results: { bindings: SparqlRow[] } }>(
    'wikidata-labels',
    `${URLS.wikidata}?format=json&query=${encodeURIComponent(sparql)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
  );

  const areaSparql = `
    SELECT ?iso ?m2 ?rank WHERE {
      ?c wdt:P298 ?iso .
      FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
      ?c p:P2046 ?st . ?st wikibase:rank ?rank .
      FILTER(?rank != wikibase:DeprecatedRank)
      ?st psn:P2046/wikibase:quantityAmount ?m2 .
    }`;
  const wdAreaRaw = await fetchCached<{ results: { bindings: { iso: { value: string }; m2: { value: string }; rank: { value: string } }[] } }>(
    'wikidata-area',
    `${URLS.wikidata}?format=json&query=${encodeURIComponent(areaSparql)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
  );
  const wdArea = new Map<string, { km2: number; preferred: boolean }[]>();
  for (const b of wdAreaRaw.results.bindings) {
    const iso = b.iso.value === 'XKX' ? 'UNK' : b.iso.value;
    const list = wdArea.get(iso) ?? [];
    list.push({ km2: Number(b.m2.value) / 1e6, preferred: b.rank.value.endsWith('PreferredRank') });
    wdArea.set(iso, list);
  }

  const warnings: string[] = [];

  // World Bank → map by app id
  const toMap = (rows: WbRow[]) => {
    const m = new Map<string, SourcedValue<number>>();
    for (const r of rows) {
      if (r.value == null) continue;
      const id = WB_TO_APP[r.countryiso3code] ?? r.countryiso3code;
      m.set(id, { value: r.value, source: 'worldbank', year: Number(r.date) });
    }
    return m;
  };
  const areaWB = toMap(wbArea[1]);
  const popWB = toMap(wbPop[1]);

  // Wikidata → per iso: names + capital labels (keyed by English label)
  type WdEntry = { uz?: string; ru?: string; caps: Map<string, { uz?: string; ru?: string }> };
  const wdNames = new Map<string, WdEntry>();
  for (const b of wd.results.bindings) {
    const iso = b.iso.value;
    const entry: WdEntry = wdNames.get(iso) ?? { caps: new Map() };
    entry.uz ??= b.uz?.value;
    entry.ru ??= b.ru?.value;
    if (b.capEn) {
      const cap = entry.caps.get(b.capEn.value) ?? {};
      cap.uz ??= b.capUz?.value;
      cap.ru ??= b.capRu?.value;
      entry.caps.set(b.capEn.value, cap);
    }
    wdNames.set(iso, entry);
  }

  // Normalise world topology ids to alpha-3 and compute geometry areas.
  const numToAlpha = new Map(raw.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca3]));
  const geomArea = new Map<string, number>();
  const seen = new Set<string>();
  const geoms = world.objects.countries.geometries;
  for (const g of geoms) {
    const name = (g.properties as { name?: string } | undefined)?.name ?? '';
    let id = g.id != null ? numToAlpha.get(String(g.id)) : WORLD_NAME_TO_ID[name];
    // world-atlas assigns 036 to both Australia and Ashmore & Cartier Is.
    if (id && seen.has(id)) {
      warnings.push(`world-atlas: duplicate id for "${name}" → detached from ${id}`);
      id = undefined;
    }
    g.id = id ?? `X-${name}`;
    if (id) seen.add(id);
    const f = feature(world, g) as Feature<Geometry>;
    const km2 = geoArea(f) * EARTH_RADIUS_KM ** 2;
    if (id) geomArea.set(id, Math.round(km2));
  }

  const loc = (en: string, uz?: string, ru?: string): LocalizedText => ({ en, uz: uz ?? en, ru: ru ?? en });

  const countries: Country[] = raw
    .map((c): Country => {
      const id = c.cca3;
      const wdEntry = wdNames.get(id === 'UNK' ? 'XKX' : id) ?? wdNames.get(id);
      let status: CountryStatus = c.unMember || SOVEREIGN_NON_UN.has(id) ? 'sovereign' : 'territory';
      if (PARTIAL[id]) status = 'partial';

      // --- area reconciliation (World Bank if confirmed, else consensus)
      const md: SourcedValue<number> | null = c.area > 0 ? { value: c.area, source: 'mledoze-countries' } : null;
      const wb = areaWB.get(id) ?? null;
      const wdList = wdArea.get(id) ?? [];
      const anchor = md?.value ?? wb?.value;
      const wdPick =
        wdList.find((w) => w.preferred) ??
        (anchor ? [...wdList].sort((a, b) => relDiffPct(a.km2, anchor) - relDiffPct(b.km2, anchor))[0] : wdList[0]);
      const wdv: SourcedValue<number> | null = wdPick ? { value: Math.round(wdPick.km2 * 100) / 100, source: 'wikidata' } : null;
      const { primary, reason } = reconcileArea([wb, wdv, md].filter((v): v is SourcedValue<number> => v !== null), geomArea.get(id));
      const alternates = [wb, wdv, md].filter((v): v is SourcedValue<number> => v !== null && v !== primary);
      const discrepancyPct = alternates.length
        ? Math.max(...alternates.map((a) => relDiffPct(a.value, primary.value)))
        : 0;
      if (discrepancyPct > DISCREPANCY_WARN_PCT && status !== 'territory') {
        warnings.push(
          `area ${id}: ${[wb, wdv, md].filter(Boolean).map((v) => `${v!.source}=${v!.value}`).join(', ')} → ${primary.source} (${reason})`,
        );
      }
      const area: AreaRecord = {
        ...primary,
        alternates,
        discrepancyPct: Math.round(discrepancyPct * 100) / 100,
        geometryKm2: geomArea.get(id) ?? null,
      };

      const capitals = (c.capital ?? []).map((en) => {
        const t = wdEntry?.caps.get(en);
        return loc(en, t?.uz, t?.ru);
      });

      return {
        id,
        cca2: c.cca2,
        ccn3: c.ccn3 || null,
        name: loc(c.name.common, wdEntry?.uz, c.translations.rus?.common ?? wdEntry?.ru),
        officialName: c.name.official,
        capitals,
        region: c.region,
        subregion: c.subregion,
        status,
        ...(PARTIAL[id] ? { statusNote: PARTIAL[id] } : {}),
        area,
        population: popWB.get(id) ?? null,
        borders: c.borders,
        landlocked: c.landlocked,
        latlng: c.latlng,
        flagSvg: `https://flagcdn.com/${c.cca2.toLowerCase()}.svg`,
        flagEmoji: c.flag,
        hasGeometry: geomArea.has(id),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  // Sanity checks — fail loudly on data that would break games.
  const byId = new Map(countries.map((c) => [c.id, c]));
  for (const c of countries) {
    for (const b of c.borders) {
      const other = byId.get(b);
      if (!other) warnings.push(`borders ${c.id}: unknown neighbour ${b}`);
      else if (!other.borders.includes(c.id)) warnings.push(`borders ${c.id}↔${b}: not symmetric`);
    }
    if (c.status === 'sovereign' && !c.hasGeometry) warnings.push(`geometry missing for sovereign ${c.id}`);
    if (c.status === 'sovereign' && !c.population) warnings.push(`population missing for ${c.id}`);
    if (c.area.value <= 0) warnings.push(`area missing for ${c.id}`);
  }
  const mustBe: [string, number, number][] = [
    ['RUS', 17_000_000, 17_200_000],
    ['FRA', 540_000, 675_000],
    ['UZB', 440_000, 460_000],
    ['VAT', 0.3, 1],
  ];
  for (const [id, lo, hi] of mustBe) {
    const v = byId.get(id)?.area.value ?? -1;
    if (v < lo || v > hi) throw new Error(`Sanity check failed: area ${id}=${v} not in [${lo}, ${hi}]`);
  }

  // ---------------------------------------------------------------- write
  await mkdir(OUT, { recursive: true });
  const countriesName = `countries.v${DATA_VERSION}.json`;
  const worldName = `world-50m.v${DATA_VERSION}.json`;
  const generatedAt = fetchedAt;

  const countriesFile: CountriesFile = { version: DATA_VERSION, generatedAt, countries };
  await writeFile(join(OUT, countriesName), JSON.stringify(countriesFile));
  await writeFile(join(OUT, worldName), JSON.stringify(world));

  const sources: SourceInfo[] = [
    { id: 'mledoze-countries', name: 'mledoze/countries (REST Countries dataset)', url: URLS.countries, license: 'ODbL-1.0', fetchedAt },
    { id: 'worldbank', name: 'World Bank Open Data (AG.SRF.TOTL.K2, SP.POP.TOTL)', url: 'https://data.worldbank.org', license: 'CC BY 4.0', fetchedAt, upstreamUpdated: wbArea[0].lastupdated },
    { id: 'wikidata', name: 'Wikidata SPARQL (uz/ru labels, area P2046)', url: 'https://query.wikidata.org', license: 'CC0', fetchedAt },
    { id: 'natural-earth', name: 'Natural Earth 1:50m via world-atlas@2', url: URLS.world, license: 'Public domain', fetchedAt },
  ];
  const manifest: DataManifest = {
    version: DATA_VERSION,
    generatedAt,
    files: { countries: countriesName, world: worldName },
    sources,
    stats: {
      countries: countries.length,
      withGeometry: countries.filter((c) => c.hasGeometry).length,
      withPopulation: countries.filter((c) => c.population).length,
      areaDiscrepancies: countries.filter((c) => c.area.discrepancyPct > DISCREPANCY_WARN_PCT).length,
    },
    warnings,
  };
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✓ ${countries.length} countries → public/data/${countriesName}`);
  console.log(`✓ world topology → public/data/${worldName}`);
  console.log(`  stats: ${JSON.stringify(manifest.stats)}`);
  console.log(`  ${warnings.length} warnings (see manifest.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

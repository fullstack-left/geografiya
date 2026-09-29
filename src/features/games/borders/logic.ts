/** Border Chain — pure graph logic. */
import type { Country } from '@/data/types';
import { shuffle } from '@/lib/random';

export type Graph = Map<string, Set<string>>;

/**
 * Undirected land-border graph over the given countries. Only symmetric
 * edges are kept (both sides list each other), which drops data errors such
 * as Sri Lanka ↔ India (no land border).
 */
export function buildGraph(countries: readonly Country[]): Graph {
  const byId = new Map(countries.map((c) => [c.id, c]));
  const g: Graph = new Map(countries.map((c) => [c.id, new Set<string>()]));
  for (const c of countries) {
    for (const b of c.borders) {
      const o = byId.get(b);
      if (o && o.borders.includes(c.id)) g.get(c.id)!.add(b);
    }
  }
  return g;
}

/** BFS distances from `from` (hops). */
export function distances(g: Graph, from: string): Map<string, number> {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    for (const n of g.get(cur) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/** One shortest path (inclusive), or null when unreachable. */
export function shortestPath(g: Graph, from: string, to: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    if (cur === to) break;
    for (const n of [...(g.get(cur) ?? [])].sort()) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (prev.get(path[0]!)) path.unshift(prev.get(path[0]!)!);
  return path;
}

export type ChainDifficulty = 'easy' | 'medium' | 'hard';
export const HOPS: Record<ChainDifficulty, [number, number]> = { easy: [2, 3], medium: [4, 5], hard: [6, 8] };

export interface Puzzle {
  start: string;
  target: string;
  optimal: number;
}

export function pickPuzzles(g: Graph, d: ChainDifficulty, n: number, rng: () => number): Puzzle[] {
  const [lo, hi] = HOPS[d];
  const out: Puzzle[] = [];
  const used = new Set<string>();
  for (const start of shuffle([...g.keys()].filter((id) => g.get(id)!.size > 0), rng)) {
    if (out.length >= n) break;
    if (used.has(start)) continue;
    const dist = distances(g, start);
    const targets = [...dist].filter(([id, h]) => h >= lo && h <= hi && !used.has(id));
    if (!targets.length) continue;
    const [target, optimal] = targets[Math.floor(rng() * targets.length)]!;
    used.add(start).add(target);
    out.push({ start, target, optimal });
  }
  return out;
}

export type StepResult = 'ok' | 'reached' | 'not-neighbour' | 'already-used' | 'unknown';

/** Validate appending `id` to the chain (chain[0] = start). */
export function step(g: Graph, chain: readonly string[], target: string, id: string): StepResult {
  if (!g.has(id)) return 'unknown';
  if (chain.includes(id)) return 'already-used';
  if (!g.get(chain[chain.length - 1]!)!.has(id)) return 'not-neighbour';
  return id === target ? 'reached' : 'ok';
}

/** Next country on a shortest path from the chain end (for hints). */
export function hint(g: Graph, chain: readonly string[], target: string): string | null {
  const p = shortestPath(g, chain[chain.length - 1]!, target);
  return p && p.length > 1 ? p[1]! : null;
}

/**
 * 100 for an optimal route; −15 per extra hop, −10 per invalid guess,
 * −25 per hint. Giving up scores 0.
 */
export function chainScore(optimal: number, used: number, wrong: number, hints: number): number {
  return Math.max(0, 100 - 15 * Math.max(0, used - optimal) - 10 * wrong - 25 * hints);
}

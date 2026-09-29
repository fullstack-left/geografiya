import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { review, weight, type Card } from '@/lib/srs';
import type { GameId } from '@/features/games/registry';

export interface GameRecord {
  game: GameId;
  score: number;
  /** 0–100 */
  accuracy: number;
  at: number;
  /** Mode / difficulty label, e.g. "easy", "population". */
  variant?: string;
}

interface ProgressState {
  /** key = `${deck}:${itemId}` */
  cards: Record<string, Card>;
  history: GameRecord[];
  /** Daily challenge results keyed by YYYY-MM-DD. */
  daily: Record<string, { score: number; correct: number; total: number; grid: string }>;
  answer: (deck: string, itemId: string, correct: boolean) => void;
  record: (r: Omit<GameRecord, 'at'>) => void;
  saveDaily: (date: string, r: ProgressState['daily'][string]) => void;
}

const MAX_HISTORY = 500;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      cards: {},
      history: [],
      daily: {},
      answer: (deck, itemId, correct) =>
        set((s) => {
          const key = `${deck}:${itemId}`;
          return { cards: { ...s.cards, [key]: review(s.cards[key], correct, Date.now()) } };
        }),
      record: (r) => set((s) => ({ history: [...s.history, { ...r, at: Date.now() }].slice(-MAX_HISTORY) })),
      saveDaily: (date, r) => set((s) => (s.daily[date] ? s : { daily: { ...s.daily, [date]: r } })),
    }),
    { name: 'geomaster-progress', version: 1 },
  ),
);

/** SRS weight function for a deck, read once (non-reactive) at question generation. */
export function srsWeight(deck: string): (itemId: string) => number {
  const { cards } = useProgress.getState();
  const now = Date.now();
  return (id) => weight(cards[`${deck}:${id}`], now);
}

export function bestScore(game: GameId, variant?: string): number {
  return useProgress
    .getState()
    .history.filter((h) => h.game === game && (variant === undefined || h.variant === variant))
    .reduce((m, h) => Math.max(m, h.score), 0);
}

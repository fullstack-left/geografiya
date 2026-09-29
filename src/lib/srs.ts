/**
 * Minimal Leitner-style spaced repetition — pure functions.
 *
 * Every (game, item) pair is a card. A wrong answer sends the card back to
 * box 0 (due again soon); a right answer promotes it one box and pushes the
 * due date out exponentially. Question generators then prefer due cards, so
 * countries you got wrong come back later.
 */
export interface Card {
  box: number;
  due: number;
  seen: number;
  wrong: number;
}

const MINUTE = 60_000;
/** Interval per box: 10 min, 1 h, 1 day, 3 days, 1 week, 1 month. */
export const BOX_INTERVALS = [10 * MINUTE, 60 * MINUTE, 1440 * MINUTE, 3 * 1440 * MINUTE, 7 * 1440 * MINUTE, 30 * 1440 * MINUTE];
export const MAX_BOX = BOX_INTERVALS.length - 1;

export const newCard = (): Card => ({ box: 0, due: 0, seen: 0, wrong: 0 });

export function review(card: Card | undefined, correct: boolean, now: number): Card {
  const c = card ?? newCard();
  const box = correct ? Math.min(MAX_BOX, c.box + 1) : 0;
  return { box, due: now + BOX_INTERVALS[box]!, seen: c.seen + 1, wrong: c.wrong + (correct ? 0 : 1) };
}

/**
 * Selection weight. Unseen cards are neutral (1); due cards that were missed
 * before weigh most; well-known cards that aren't due are rarely picked.
 */
export function weight(card: Card | undefined, now: number): number {
  if (!card) return 1;
  const due = card.due <= now;
  if (due) return 1.5 + (card.wrong > 0 ? 3 : 0) + (MAX_BOX - card.box) * 0.3;
  return 0.15 + (MAX_BOX - card.box) * 0.05;
}

/** Weighted sampling without replacement. */
export function weightedSample<T>(items: readonly T[], n: number, w: (t: T) => number, rng: () => number): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0, w(item)) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let x = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      x -= pool[i]!.w;
      if (x <= 0) break;
    }
    out.push(pool[i]!.item);
    pool.splice(i, 1);
  }
  return out;
}

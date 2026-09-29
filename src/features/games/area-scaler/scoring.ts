/**
 * Area Scaler scoring — pure functions, no UI.
 *
 * Ratios are geometric quantities (guessing 2× when truth is 1× is as wrong as
 * guessing 0.5×), so the error is measured in log space:
 *
 *   accuracy = max(0, 100 − |ln(userRatio / trueRatio)| × 100)
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };

export function accuracy(userRatio: number, trueRatio: number): number {
  if (!(userRatio > 0) || !(trueRatio > 0) || !Number.isFinite(userRatio) || !Number.isFinite(trueRatio)) {
    return 0;
  }
  const raw = 100 - Math.abs(Math.log(userRatio / trueRatio)) * 100;
  return Math.max(0, Math.round(raw));
}

/** Signed error in percent: +25 means the guess was 25 % too big. */
export function errorPercent(userRatio: number, trueRatio: number): number {
  return (userRatio / trueRatio - 1) * 100;
}

export function roundPoints(acc: number, difficulty: Difficulty): number {
  return Math.round(acc * DIFFICULTY_MULTIPLIER[difficulty]);
}

export type Grade = 'perfect' | 'excellent' | 'good' | 'fair' | 'miss';

export function grade(acc: number): Grade {
  if (acc >= 95) return 'perfect';
  if (acc >= 85) return 'excellent';
  if (acc >= 70) return 'good';
  if (acc >= 50) return 'fair';
  return 'miss';
}

export interface RoundResult {
  referenceId: string;
  targetId: string;
  userRatio: number;
  trueRatio: number;
  accuracy: number;
  points: number;
}

export function summarize(results: RoundResult[]) {
  const total = results.reduce((s, r) => s + r.points, 0);
  const avgAccuracy = results.length ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
  const best = results.reduce<RoundResult | null>((b, r) => (!b || r.accuracy > b.accuracy ? r : b), null);
  return { total, avgAccuracy: Math.round(avgAccuracy), best };
}

/** Slider limits for the user's ratio guess (covers the hard mode's 50×). */
export const MIN_RATIO = 1 / 80;
export const MAX_RATIO = 80;
export const clampRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));

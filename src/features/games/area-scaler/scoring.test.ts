import { describe, expect, it } from 'vitest';
import { accuracy, clampRatio, errorPercent, grade, MAX_RATIO, MIN_RATIO, roundPoints, summarize } from './scoring';

describe('accuracy', () => {
  it('is 100 for an exact guess', () => {
    expect(accuracy(3.7, 3.7)).toBe(100);
  });

  it('follows max(0, 100 - |ln(u/t)| * 100), rounded', () => {
    expect(accuracy(1.1, 1)).toBe(Math.round(100 - Math.log(1.1) * 100)); // 90
    expect(accuracy(1.5, 1)).toBe(59);
    expect(accuracy(2, 1)).toBe(31);
  });

  it('is symmetric in log space (2× too big == 2× too small)', () => {
    expect(accuracy(8, 4)).toBe(accuracy(2, 4));
    expect(accuracy(0.1, 0.2)).toBe(accuracy(0.4, 0.2));
  });

  it('is scale invariant', () => {
    expect(accuracy(30, 25)).toBe(accuracy(1.2, 1));
  });

  it('never goes below 0', () => {
    expect(accuracy(50, 1)).toBe(0);
    expect(accuracy(1 / 50, 1)).toBe(0);
  });

  it('returns 0 for invalid input', () => {
    expect(accuracy(0, 1)).toBe(0);
    expect(accuracy(-2, 1)).toBe(0);
    expect(accuracy(1, 0)).toBe(0);
    expect(accuracy(Number.NaN, 1)).toBe(0);
    expect(accuracy(Number.POSITIVE_INFINITY, 1)).toBe(0);
  });
});

describe('errorPercent / points / grade', () => {
  it('reports signed relative error', () => {
    expect(errorPercent(5, 4)).toBeCloseTo(25);
    expect(errorPercent(3, 4)).toBeCloseTo(-25);
  });

  it('applies difficulty multipliers', () => {
    expect(roundPoints(80, 'easy')).toBe(80);
    expect(roundPoints(80, 'medium')).toBe(120);
    expect(roundPoints(80, 'hard')).toBe(160);
  });

  it('grades by thresholds', () => {
    expect(grade(100)).toBe('perfect');
    expect(grade(95)).toBe('perfect');
    expect(grade(94)).toBe('excellent');
    expect(grade(70)).toBe('good');
    expect(grade(50)).toBe('fair');
    expect(grade(49)).toBe('miss');
  });

  it('clamps ratios to the slider range', () => {
    expect(clampRatio(1000)).toBe(MAX_RATIO);
    expect(clampRatio(0)).toBe(MIN_RATIO);
    expect(clampRatio(2)).toBe(2);
  });
});

describe('summarize', () => {
  it('totals points and averages accuracy', () => {
    const base = { referenceId: 'A', targetId: 'B', userRatio: 1, trueRatio: 1 };
    const s = summarize([
      { ...base, accuracy: 90, points: 90 },
      { ...base, accuracy: 60, points: 60 },
      { ...base, accuracy: 75, points: 75 },
    ]);
    expect(s.total).toBe(225);
    expect(s.avgAccuracy).toBe(75);
    expect(s.best?.accuracy).toBe(90);
  });

  it('handles an empty game', () => {
    expect(summarize([])).toEqual({ total: 0, avgAccuracy: 0, best: null });
  });
});

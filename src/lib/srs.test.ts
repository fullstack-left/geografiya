import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random';
import { BOX_INTERVALS, MAX_BOX, review, weight, weightedSample } from './srs';

describe('srs', () => {
  it('promotes on correct, resets on wrong', () => {
    let c = review(undefined, true, 0);
    expect(c).toMatchObject({ box: 1, due: BOX_INTERVALS[1], seen: 1, wrong: 0 });
    c = review(c, true, 0);
    expect(c.box).toBe(2);
    c = review(c, false, 1000);
    expect(c).toMatchObject({ box: 0, due: 1000 + BOX_INTERVALS[0]!, seen: 3, wrong: 1 });
  });

  it('caps at the last box', () => {
    let c = review(undefined, true, 0);
    for (let i = 0; i < 20; i++) c = review(c, true, 0);
    expect(c.box).toBe(MAX_BOX);
  });

  it('weights due, previously-missed cards above unseen, and known cards below', () => {
    const missed = review(undefined, false, 0);
    const known = review(review(review(undefined, true, 0), true, 0), true, 0);
    const now = BOX_INTERVALS[0]! + 1;
    expect(weight(missed, now)).toBeGreaterThan(weight(undefined, now));
    expect(weight(known, now)).toBeLessThan(weight(undefined, now));
  });

  it('weightedSample samples without replacement and favours heavy items', () => {
    const items = ['a', 'b', 'c', 'd'];
    const s = weightedSample(items, 4, () => 1, mulberry32(1));
    expect([...s].sort()).toEqual(items);
    let heavyFirst = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (weightedSample(items, 1, (x) => (x === 'c' ? 20 : 1), mulberry32(seed))[0] === 'c') heavyFirst++;
    }
    expect(heavyFirst).toBeGreaterThan(150);
  });
});

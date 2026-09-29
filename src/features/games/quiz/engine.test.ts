import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/lib/random';
import { byId, countries } from '@/test/fixtures';
import {
  LOOKALIKE_FLAGS,
  QUESTION_MS,
  buildQuestions,
  capitalSpecs,
  flagSpecs,
  initQuiz,
  pickDistractors,
  questionPoints,
  quizReducer,
  quizSummary,
} from './engine';

describe('questionPoints', () => {
  it('is 0 for wrong answers', () => expect(questionPoints(false, QUESTION_MS, 5)).toBe(0));
  it('gives 100 + speed + streak', () => {
    expect(questionPoints(true, 0, 0)).toBe(100);
    expect(questionPoints(true, QUESTION_MS, 0)).toBe(150);
    expect(questionPoints(true, QUESTION_MS / 2, 2)).toBe(145);
    expect(questionPoints(true, QUESTION_MS, 99)).toBe(200); // streak capped at 5
  });
});

describe('pickDistractors', () => {
  it('returns distinct countries, never the answer, preferring the same subregion', () => {
    const uzb = byId.get('UZB')!;
    for (let s = 0; s < 20; s++) {
      const d = pickDistractors(uzb, countries, 3, mulberry32(s));
      expect(d).toHaveLength(3);
      expect(new Set(d.map((c) => c.id)).size).toBe(3);
      expect(d.some((c) => c.id === 'UZB')).toBe(false);
      expect(d.filter((c) => c.subregion === 'Central Asia').length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('buildQuestions', () => {
  it('builds valid 4-option questions with unique answers', () => {
    const qs = buildQuestions(countries, capitalSpecs.countryToCapital, { count: 10, rng: mulberry32(1) });
    expect(qs).toHaveLength(10);
    const answers = qs.map((q) => q.options[q.answer]);
    expect(new Set(answers).size).toBe(10);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('never offers two options with the same capital name', () => {
    for (let s = 0; s < 50; s++) {
      for (const q of buildQuestions(countries, capitalSpecs.countryToCapital, { count: 10, rng: mulberry32(s) })) {
        const caps = q.options.map((id) => byId.get(id)!.capitals[0]!.en);
        expect(new Set(caps).size).toBe(4);
      }
    }
  });

  it('never puts look-alike flags in the same question', () => {
    for (let s = 0; s < 80; s++) {
      for (const q of buildQuestions(countries, flagSpecs.flagToCountry, { count: 10, rng: mulberry32(s) })) {
        for (const group of LOOKALIKE_FLAGS) {
          const inGroup = q.options.filter((id) => group.includes(id));
          expect(inGroup.length, q.options.join(',')).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('respects SRS weights (heavily weighted items appear first)', () => {
    const qs = buildQuestions(countries, flagSpecs.flagToCountry, { count: 3, rng: mulberry32(3), weight: (id) => (id === 'UZB' ? 1e6 : 1) });
    expect(qs.map((q) => q.options[q.answer])).toContain('UZB');
  });

  it('every capital-quiz country has a capital', () => {
    for (const c of countries.filter(capitalSpecs.countryToCapital.eligible)) expect(c.capitals[0]!.en.length).toBeGreaterThan(0);
  });
});

describe('quiz reducer', () => {
  const qs = buildQuestions(countries, capitalSpecs.countryToCapital, { count: 3, rng: mulberry32(9) });

  it('plays through, counting streaks and timeouts', () => {
    let s = initQuiz(qs);
    s = quizReducer(s, { type: 'answer', chosen: qs[0]!.answer, msLeft: QUESTION_MS });
    expect(s.phase).toBe('feedback');
    expect(s.answers[0]).toMatchObject({ correct: true, points: 150 });
    // answering twice is ignored
    expect(quizReducer(s, { type: 'answer', chosen: 0, msLeft: 0 }).answers).toHaveLength(1);
    s = quizReducer(s, { type: 'next' });
    s = quizReducer(s, { type: 'answer', chosen: qs[1]!.answer, msLeft: 0 });
    expect(s.answers[1]!.points).toBe(110); // streak 1
    s = quizReducer(quizReducer(s, { type: 'next' }), { type: 'timeout' });
    expect(s.answers[2]).toMatchObject({ chosen: -1, correct: false, points: 0 });
    s = quizReducer(s, { type: 'next' });
    expect(s.phase).toBe('summary');
    expect(quizSummary(s.answers)).toMatchObject({ correct: 2, total: 3, accuracy: 67, bestStreak: 2, score: 260 });
  });

  it('an empty quiz goes straight to the summary', () => {
    expect(initQuiz([]).phase).toBe('summary');
  });
});

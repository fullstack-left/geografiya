/**
 * Multiple-choice quiz engine — pure, UI-agnostic. Used by Capitals, Flags,
 * Shapes and the Daily Challenge.
 */
import type { Country } from '@/data/types';
import { shuffle } from '@/lib/random';
import { weightedSample } from '@/lib/srs';

/** What is shown as the question. */
export type Prompt =
  | { kind: 'country'; countryId: string }
  | { kind: 'capital'; countryId: string }
  | { kind: 'flag'; countryId: string }
  | { kind: 'shape'; countryId: string };

/** How each option is rendered. */
export type OptionKind = 'country' | 'capital' | 'flag';

export interface ChoiceQuestion {
  /** SRS deck, e.g. "capitals". */
  deck: string;
  /** Localised instruction key suffix, e.g. "capitalOf". */
  ask: string;
  prompt: Prompt;
  optionKind: OptionKind;
  /** Country ids; the answer is `options[answer]`. */
  options: string[];
  answer: number;
}

export const OPTIONS = 4;
export const QUESTION_MS = 15_000;

// ---------------------------------------------------------------- scoring

/** 100 for a correct answer + up to 50 for speed + 10 per streak step (max 50). */
export function questionPoints(correct: boolean, msLeft: number, streak: number): number {
  if (!correct) return 0;
  const speed = Math.round(50 * Math.min(1, Math.max(0, msLeft / QUESTION_MS)));
  return 100 + speed + Math.min(streak, 5) * 10;
}

// ---------------------------------------------------------------- distractors

/**
 * Plausible wrong options: prefer the same subregion, then region, then any.
 * `conflict(a)(b)` is true when a and b must not appear in the same question
 * (same capital name, look-alike flags); it is checked for EVERY pair of
 * options, not just against the answer.
 */
export function pickDistractors(
  answer: Country,
  pool: readonly Country[],
  n: number,
  rng: () => number,
  conflict?: (a: Country) => (b: Country) => boolean,
): Country[] {
  const clashes = (c: Country, chosen: Country[]) => !!conflict && chosen.some((p) => conflict(p)(c));
  const candidates = pool.filter((c) => c.id !== answer.id && !clashes(c, [answer]));
  const tiers = [
    candidates.filter((c) => c.subregion && c.subregion === answer.subregion),
    candidates.filter((c) => c.region === answer.region && c.subregion !== answer.subregion),
    candidates.filter((c) => c.region !== answer.region),
  ];
  const out: Country[] = [];
  // Take up to 2 from the closest tier so it isn't always "all neighbours".
  const quotas = [2, n, n];
  tiers.forEach((tier, i) => {
    let taken = 0;
    for (const c of shuffle(tier, rng)) {
      if (out.length >= n || taken >= quotas[i]!) break;
      if (clashes(c, out)) continue;
      out.push(c);
      taken++;
    }
  });
  return out;
}

// ---------------------------------------------------------------- builders

export interface BuildOptions {
  count: number;
  rng: () => number;
  /** SRS weight by country id. */
  weight?: (id: string) => number;
}

type Spec = {
  deck: string;
  ask: string;
  prompt: (c: Country) => Prompt;
  optionKind: OptionKind;
  /** Countries eligible to be the ANSWER. */
  eligible: (c: Country) => boolean;
  /** Countries eligible as distractors (defaults to eligible). */
  distractorPool?: (c: Country) => boolean;
  exclude?: (answer: Country) => (c: Country) => boolean;
};

export function buildQuestions(countries: readonly Country[], spec: Spec, o: BuildOptions): ChoiceQuestion[] {
  const eligible = countries.filter(spec.eligible);
  const distractors = countries.filter(spec.distractorPool ?? spec.eligible);
  const answers = weightedSample(eligible, o.count, (c) => o.weight?.(c.id) ?? 1, o.rng);
  return answers.flatMap((a) => {
    const wrong = pickDistractors(a, distractors, OPTIONS - 1, o.rng, spec.exclude);
    if (wrong.length < OPTIONS - 1) return [];
    const options = shuffle([a, ...wrong], o.rng).map((c) => c.id);
    return [{ deck: spec.deck, ask: spec.ask, prompt: spec.prompt(a), optionKind: spec.optionKind, options, answer: options.indexOf(a.id) }];
  });
}

const primaryCapital = (c: Country) => c.capitals[0]?.en;
const hasCapital = (c: Country) => c.capitals.length > 0;

export const capitalSpecs = {
  /** "What is the capital of X?" → capital names */
  countryToCapital: {
    deck: 'capitals',
    ask: 'capitalOf',
    prompt: (c: Country): Prompt => ({ kind: 'country', countryId: c.id }),
    optionKind: 'capital',
    eligible: hasCapital,
    // never offer a capital shared by another country (e.g. Jerusalem claims)
    exclude: (a: Country) => (c: Country) => c.capitals.some((k) => a.capitals.some((x) => x.en === k.en)),
  },
  /** "X is the capital of…?" → country names */
  capitalToCountry: {
    deck: 'capitals',
    ask: 'countryOfCapital',
    prompt: (c: Country): Prompt => ({ kind: 'capital', countryId: c.id }),
    optionKind: 'country',
    eligible: hasCapital,
    exclude: (a: Country) => (c: Country) => primaryCapital(c) === primaryCapital(a),
  },
} satisfies Record<string, Spec>;

/** Countries whose flags are near-identical — never offered side by side. */
export const LOOKALIKE_FLAGS: string[][] = [
  ['TCD', 'ROU', 'AND', 'MDA'],
  ['IDN', 'MCO', 'POL'],
  ['NLD', 'LUX'],
  ['AUS', 'NZL'],
  ['IRL', 'CIV', 'ITA'],
  ['NOR', 'ISL'],
  ['SEN', 'MLI', 'GIN'],
  ['VEN', 'ECU', 'COL'],
  ['SVN', 'SVK', 'RUS'],
  ['NER', 'IND'],
];

export const isLookalike = (a: Country) => (c: Country) =>
  LOOKALIKE_FLAGS.some((g) => g.includes(a.id) && g.includes(c.id));

export const flagSpecs = {
  flagToCountry: {
    deck: 'flags',
    ask: 'whoseFlag',
    prompt: (c: Country): Prompt => ({ kind: 'flag', countryId: c.id }),
    optionKind: 'country',
    eligible: () => true,
    exclude: isLookalike,
  },
  countryToFlag: {
    deck: 'flags',
    ask: 'flagOf',
    prompt: (c: Country): Prompt => ({ kind: 'country', countryId: c.id }),
    optionKind: 'flag',
    eligible: () => true,
    exclude: isLookalike,
  },
} satisfies Record<string, Spec>;

export const shapeSpec = (eligible: (c: Country) => boolean): Spec => ({
  deck: 'shapes',
  ask: 'whoseShape',
  prompt: (c) => ({ kind: 'shape', countryId: c.id }),
  optionKind: 'country',
  eligible,
});

// ---------------------------------------------------------------- state

export type QuizPhase = 'question' | 'feedback' | 'summary';

export interface QuizAnswer {
  question: ChoiceQuestion;
  /** -1 when the timer ran out */
  chosen: number;
  correct: boolean;
  points: number;
  ms: number;
}

export interface QuizState {
  phase: QuizPhase;
  questions: ChoiceQuestion[];
  index: number;
  streak: number;
  answers: QuizAnswer[];
}

export type QuizAction =
  | { type: 'answer'; chosen: number; msLeft: number }
  | { type: 'timeout' }
  | { type: 'next' };

export const initQuiz = (questions: ChoiceQuestion[]): QuizState => ({
  phase: questions.length ? 'question' : 'summary',
  questions,
  index: 0,
  streak: 0,
  answers: [],
});

export function quizReducer(s: QuizState, a: QuizAction): QuizState {
  switch (a.type) {
    case 'answer':
    case 'timeout': {
      if (s.phase !== 'question') return s;
      const q = s.questions[s.index]!;
      const chosen = a.type === 'answer' ? a.chosen : -1;
      const msLeft = a.type === 'answer' ? a.msLeft : 0;
      const correct = chosen === q.answer;
      const points = questionPoints(correct, msLeft, s.streak);
      return {
        ...s,
        phase: 'feedback',
        streak: correct ? s.streak + 1 : 0,
        answers: [...s.answers, { question: q, chosen, correct, points, ms: QUESTION_MS - msLeft }],
      };
    }
    case 'next':
      if (s.phase !== 'feedback') return s;
      return s.index + 1 >= s.questions.length ? { ...s, phase: 'summary' } : { ...s, phase: 'question', index: s.index + 1 };
  }
}

export function quizSummary(answers: QuizAnswer[]) {
  const correct = answers.filter((a) => a.correct).length;
  return {
    score: answers.reduce((s, a) => s + a.points, 0),
    correct,
    total: answers.length,
    accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
    bestStreak: answers.reduce(
      (acc, a) => {
        const cur = a.correct ? acc.cur + 1 : 0;
        return { cur, best: Math.max(acc.best, cur) };
      },
      { cur: 0, best: 0 },
    ).best,
  };
}

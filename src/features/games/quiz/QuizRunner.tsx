import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { WorldTopology } from '@/data/queries';
import type { Country, Locale } from '@/data/types';
import { play } from '@/lib/sound';
import { useSettings } from '@/stores/settings';
import { useProgress } from '@/stores/progress';
import type { GameId } from '../registry';
import { CountUp, CountryShape, Flag, GameHeader, Stat } from '../shared/ui';
import { QUESTION_MS, initQuiz, quizReducer, quizSummary, type ChoiceQuestion, type QuizAnswer } from './engine';

export type QuizSummary = ReturnType<typeof quizSummary> & { answers: QuizAnswer[] };

interface Props {
  gameId: GameId;
  variant?: string;
  title: string;
  questions: ChoiceQuestion[];
  byId: Map<string, Country>;
  world?: WorldTopology;
  timed?: boolean;
  onRestart: () => void;
  onExit: () => void;
  /** Custom summary footer (e.g. share button for the daily challenge). */
  onFinish?: (s: QuizSummary) => void;
  summaryExtra?: (s: QuizSummary) => React.ReactNode;
}

const capitalOf = (c: Country, l: Locale) => c.capitals[0]?.[l] ?? '—';

export function QuizRunner(p: Props) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const [state, dispatch] = useReducer(quizReducer, p.questions, initQuiz);
  const { answer: srsAnswer, record } = useProgress();
  const timed = p.timed ?? true;
  const q = state.questions[state.index];

  // ---- timer
  const [msLeft, setMsLeft] = useState(QUESTION_MS);
  const deadline = useRef(0);
  useEffect(() => {
    if (state.phase !== 'question' || !timed) return;
    deadline.current = performance.now() + QUESTION_MS;
    setMsLeft(QUESTION_MS);
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline.current - performance.now());
      setMsLeft(left);
      if (left <= 0) dispatch({ type: 'timeout' });
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.phase, state.index, timed]);

  const choose = useCallback(
    (i: number) => {
      if (state.phase !== 'question') return;
      dispatch({ type: 'answer', chosen: i, msLeft: timed ? Math.max(0, deadline.current - performance.now()) : QUESTION_MS });
    },
    [state.phase, timed],
  );

  // ---- side effects of answering (SRS, sound)
  const lastRecorded = useRef(-1);
  useEffect(() => {
    if (state.phase !== 'feedback' || lastRecorded.current === state.index) return;
    lastRecorded.current = state.index;
    const a = state.answers[state.answers.length - 1]!;
    const id = a.question.options[a.question.answer]!;
    srsAnswer(a.question.deck, id, a.correct);
    play(a.correct ? 'good' : 'bad');
  }, [state.phase, state.index, state.answers, srsAnswer]);

  const summary = useMemo(() => ({ ...quizSummary(state.answers), answers: state.answers }), [state.answers]);
  const finished = useRef(false);
  useEffect(() => {
    if (state.phase !== 'summary' || finished.current) return;
    finished.current = true;
    record({ game: p.gameId, variant: p.variant, score: summary.score, accuracy: summary.accuracy });
    p.onFinish?.(summary);
    play(summary.accuracy >= 70 ? 'great' : 'confirm');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ---- keyboard: 1–4 choose, Enter next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (state.phase === 'question' && /^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (state.phase === 'feedback' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) dispatch({ type: 'next' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, choose]);

  if (state.phase === 'summary') {
    return <Summary {...p} summary={summary} locale={locale} />;
  }
  if (!q) return null;

  const score = state.answers.reduce((s, a) => s + a.points, 0);
  const last = state.phase === 'feedback' ? state.answers[state.answers.length - 1]! : null;
  const answerCountry = p.byId.get(q.options[q.answer]!)!;

  return (
    <div className="mx-auto max-w-3xl">
      <GameHeader
        title={p.title}
        progress={t('quiz.question', { n: state.index + 1, total: state.questions.length })}
        right={
          <p className="font-mono text-2xl" aria-label={t('quiz.score')}>
            {score}
          </p>
        }
      />
      {timed && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2" role="timer" aria-label={t('quiz.timeLeft', { s: Math.ceil(msLeft / 1000) })}>
          <div
            className={`h-full rounded-full ${msLeft < 4000 ? 'bg-danger' : 'bg-accent'}`}
            style={{ width: `${(state.phase === 'question' ? msLeft / QUESTION_MS : (last?.ms ?? 0) >= QUESTION_MS ? 0 : 1 - (last?.ms ?? 0) / QUESTION_MS) * 100}%` }}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={state.index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          <Card className="p-6 text-center sm:p-8">
            <p className="text-sm text-ink-muted">{t(`quiz.ask.${q.ask}`)}</p>
            <PromptView q={q} byId={p.byId} world={p.world} locale={locale} />
          </Card>

          <div className={`mt-4 grid gap-3 ${q.optionKind === 'flag' ? 'grid-cols-2' : 'sm:grid-cols-2'}`} role="group" aria-label={t('quiz.options')}>
            {q.options.map((id, i) => {
              const c = p.byId.get(id)!;
              const state_ = !last ? 'idle' : i === q.answer ? 'right' : i === last.chosen ? 'wrong' : 'dim';
              const cls = {
                idle: 'border-line bg-surface hover:border-primary hover:bg-surface-2',
                right: 'border-success bg-success/15',
                wrong: 'border-danger bg-danger/15',
                dim: 'border-line bg-surface opacity-50',
              }[state_];
              const label = q.optionKind === 'capital' ? capitalOf(c, locale) : c.name[locale];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!!last}
                  onClick={() => choose(i)}
                  aria-label={q.optionKind === 'flag' ? `${i + 1}. ${t('quiz.flagOption', { n: i + 1 })}` : `${i + 1}. ${label}`}
                  className={`group flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition disabled:cursor-default ${cls}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-xs text-ink-muted">{i + 1}</span>
                  {q.optionKind === 'flag' ? (
                    <span className="flex flex-1 justify-center">
                      <Flag country={c} decorative className="max-h-16 w-auto max-w-full sm:max-h-20" />
                    </span>
                  ) : (
                    <span className="font-medium">{label}</span>
                  )}
                  {state_ === 'right' && <Icon name="check" className="ml-auto shrink-0 text-xl text-success" />}
                </button>
              );
            })}
          </div>

          {last && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p role="status" className={last.correct ? 'text-success' : 'text-danger'}>
                {last.correct ? t('quiz.correct', { points: last.points }) : last.chosen === -1 ? t('quiz.timeout') : t('quiz.wrong')}{' '}
                <span className="text-ink-muted">
                  {answerCountry.name[locale]} — {capitalOf(answerCountry, locale)}
                </span>
              </p>
              <Button onClick={() => dispatch({ type: 'next' })} autoFocus>
                {state.index + 1 >= state.questions.length ? t('quiz.results') : t('quiz.next')} <Icon name="arrow-right" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PromptView({ q, byId, world, locale }: { q: ChoiceQuestion; byId: Map<string, Country>; world?: WorldTopology; locale: Locale }) {
  const { t } = useTranslation();
  const c = byId.get(q.prompt.countryId)!;
  switch (q.prompt.kind) {
    case 'country':
      return <p className="mt-2 font-display text-4xl sm:text-5xl">{c.name[locale]}</p>;
    case 'capital':
      return <p className="mt-2 font-display text-4xl sm:text-5xl">{capitalOf(c, locale)}</p>;
    case 'flag':
      return (
        <div className="mt-4 flex justify-center">
          <Flag country={c} className="max-h-36 w-auto max-w-full sm:max-h-44" />
        </div>
      );
    case 'shape':
      return world ? (
        <div className="bg-graticule mx-auto mt-4 aspect-square w-full max-w-72 rounded-2xl">
          <CountryShape world={world} countryId={c.id} className="size-full" label={t('quiz.shapeAlt')} />
        </div>
      ) : null;
  }
}

function Summary(p: Props & { summary: QuizSummary; locale: Locale }) {
  const { t } = useTranslation();
  const { summary: s, locale } = p;
  const mistakes = s.answers.filter((a) => !a.correct);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">{p.title}</p>
      <h1 className="font-display text-4xl sm:text-5xl">{t('quiz.summaryTitle')}</h1>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat label={t('quiz.score')}>
          <CountUp value={s.score} />
        </Stat>
        <Stat label={t('quiz.correctCount')}>
          {s.correct}/{s.total}
        </Stat>
        <Stat label={t('quiz.bestStreak')}>{s.bestStreak}</Stat>
      </div>
      {p.summaryExtra?.(s)}
      {mistakes.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-2xl">{t('quiz.review')}</h2>
          <p className="text-sm text-ink-muted">{t('quiz.reviewHint')}</p>
          <ul className="mt-4 divide-y divide-line">
            {mistakes.map((a, i) => {
              const c = p.byId.get(a.question.options[a.question.answer]!)!;
              const chosen = a.chosen >= 0 ? p.byId.get(a.question.options[a.chosen]!) : undefined;
              return (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Flag country={c} decorative className="h-6 w-9 shrink-0 object-cover" />
                  <span className="font-medium">{c.name[locale]}</span>
                  <span className="text-ink-muted">— {capitalOf(c, locale)}</span>
                  {chosen && (
                    <span className="ml-auto text-xs text-danger">
                      {t('quiz.youChose')}: {a.question.optionKind === 'capital' ? capitalOf(chosen, locale) : chosen.name[locale]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={p.onRestart} autoFocus>
          {t('quiz.playAgain')}
        </Button>
        <Button variant="secondary" onClick={p.onExit}>
          {t('quiz.changeMode')}
        </Button>
      </div>
    </div>
  );
}

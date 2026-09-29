import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Country } from '@/data/types';
import { mulberry32, randomSeed } from '@/lib/random';
import { srsWeight } from '@/stores/progress';
import type { GameId } from '../registry';
import type { GameData } from '../shared/GameLoader';
import { ModePicker } from '../shared/ui';
import { buildQuestions, type ChoiceQuestion } from './engine';
import { QuizRunner } from './QuizRunner';

export const REGIONS = ['all', 'Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] as const;
export type RegionFilter = (typeof REGIONS)[number];

export interface QuizMode {
  id: string;
  spec: Parameters<typeof buildQuestions>[1];
}

export const QUESTIONS_PER_QUIZ = 10;

/** Mode picker + region filter + runner, shared by Capitals / Flags / Shapes. */
export function QuizGame({ gameId, modes, data, needsWorld }: { gameId: GameId; modes: QuizMode[]; data: GameData; needsWorld?: boolean }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(modes[0]!.id);
  const [region, setRegion] = useState<RegionFilter>('all');
  const [run, setRun] = useState<{ key: number; questions: ChoiceQuestion[] } | null>(null);
  const [empty, setEmpty] = useState(false);
  const byId = new Map(data.countries.map((c) => [c.id, c]));

  const start = () => {
    const m = modes.find((x) => x.id === mode)!;
    const inRegion = (c: Country) => region === 'all' || c.region === region;
    const spec = {
      ...m.spec,
      eligible: (c: Country) => m.spec.eligible(c) && inRegion(c),
      // distractors come from the same filtered set so options stay regional
      distractorPool: (c: Country) => (m.spec.distractorPool ?? m.spec.eligible)(c) && inRegion(c),
    };
    const questions = buildQuestions(data.countries, spec, {
      count: QUESTIONS_PER_QUIZ,
      rng: mulberry32(randomSeed()),
      weight: srsWeight(m.spec.deck),
    });
    const ok = questions.length >= 4;
    setEmpty(!ok);
    setRun(ok ? { key: Date.now(), questions } : null);
  };

  if (run) {
    return (
      <QuizRunner
        key={run.key}
        gameId={gameId}
        variant={`${mode}:${region}`}
        title={t(`games.${gameId}.name`)}
        questions={run.questions}
        byId={byId}
        world={needsWorld ? data.world : undefined}
        onRestart={start}
        onExit={() => setRun(null)}
      />
    );
  }

  return (
    <ModePicker
      title={t(`games.${gameId}.name`)}
      intro={t(`quiz.intro.${gameId}`)}
      legend={t('quiz.chooseMode')}
      modes={modes.map((m) => ({ id: m.id, name: t(`quiz.modes.${m.id}.name`), desc: t(`quiz.modes.${m.id}.desc`) }))}
      value={mode}
      onChange={setMode}
      onStart={start}
    >
      <div className="mt-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t('quiz.region')}</p>
        <div role="radiogroup" aria-label={t('quiz.region')} className="mt-3 flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={region === r}
              onClick={() => setRegion(r)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${region === r ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
            >
              {t(`regions.${r}`)}
            </button>
          ))}
        </div>
      </div>
      {empty && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {t('quiz.noQuestions')}
        </p>
      )}
    </ModePicker>
  );
}

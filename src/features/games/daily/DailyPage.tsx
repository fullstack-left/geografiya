import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, ErrorState, Seo, Skeleton } from '@/components/ui';
import { useCountries, useWorld } from '@/data/queries';
import { useProgress } from '@/stores/progress';
import { QuizRunner } from '../quiz/QuizRunner';
import { Stat } from '../shared/ui';
import { buildDaily, dateKey, msUntilNext, shareGrid, shareText } from './logic';

export function DailyPage() {
  const { t } = useTranslation();
  // Unfiltered list: the daily set must not depend on personal settings.
  const countries = useCountries();
  const world = useWorld();
  const [key] = useState(() => dateKey());
  const result = useProgress((s) => s.daily[key]);
  const saveDaily = useProgress((s) => s.saveDaily);
  const [playing, setPlaying] = useState(false);
  const questions = useMemo(() => (countries.data ? buildDaily(countries.data, key) : []), [countries.data, key]);
  const byId = useMemo(() => new Map((countries.data ?? []).map((c) => [c.id, c])), [countries.data]);

  const seo = <Seo title={t('games.daily.name')} description={t('daily.intro')} />;
  if (countries.isError || world.isError) return <ErrorState onRetry={() => void countries.refetch()} />;
  if (!countries.data || !world.data) return <Skeleton className="h-96" />;

  if (playing && !result) {
    return (
      <>
        {seo}
        <QuizRunner
          gameId="daily"
          variant={key}
          title={`${t('games.daily.name')} · ${key}`}
          questions={questions}
          byId={byId}
          world={world.data}
          onFinish={(s) =>
            saveDaily(key, { score: s.score, correct: s.correct, total: s.total, grid: shareGrid(s.answers.map((a) => a.correct)) })
          }
          onRestart={() => setPlaying(false)}
          onExit={() => setPlaying(false)}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {seo}
      <p className="font-mono text-xs uppercase tracking-widest text-accent">{key}</p>
      <h1 className="font-display text-4xl sm:text-5xl">{t('games.daily.name')}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t('daily.intro')}</p>
      {result ? <DoneCard dateKey={key} result={result} /> : (
        <Button className="mt-8 px-8 py-3 text-base" onClick={() => setPlaying(true)}>
          {t('daily.start', { n: questions.length })}
        </Button>
      )}
      <Card className="mt-8 p-5 text-sm text-ink-muted">
        <p className="font-medium text-ink">{t('daily.leaderboardTitle')}</p>
        <p className="mt-1">{t('daily.leaderboardSoon')}</p>
      </Card>
    </div>
  );
}

function DoneCard({ dateKey: key, result }: { dateKey: string; result: { score: number; correct: number; total: number; grid: string } }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(msUntilNext());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilNext()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hms = new Date(left).toISOString().slice(11, 19);
  const text = shareText(key, result.correct, result.total, result.score, result.grid);
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('quiz.score')}>{result.score}</Stat>
        <Stat label={t('quiz.correctCount')}>
          {result.correct}/{result.total}
        </Stat>
      </div>
      <p className="mt-4 flex gap-1" role="img" aria-label={t('daily.gridLabel', { correct: result.correct, total: result.total })}>
        {[...result.grid].filter((ch) => ch === '🟩' || ch === '🟥').map((ch, i) => (
          <span key={i} className={`size-6 rounded-md ${ch === '🟩' ? 'bg-success' : 'bg-danger'}`} />
        ))}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          {copied ? t('daily.copied') : t('daily.share')}
        </Button>
        <p className="font-mono text-sm text-ink-muted" aria-live="off">
          {t('daily.next', { time: hms })}
        </p>
      </div>
    </div>
  );
}

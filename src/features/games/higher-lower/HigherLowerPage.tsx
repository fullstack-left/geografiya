import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Card, Seo } from '@/components/ui';
import type { Country, Locale } from '@/data/types';
import { formatNumber } from '@/lib/format';
import { mulberry32, randomSeed } from '@/lib/random';
import { play } from '@/lib/sound';
import { bestScore, useProgress } from '@/stores/progress';
import { useSettings } from '@/stores/settings';
import { GameLoader, type GameData } from '../shared/GameLoader';
import { Flag, ModePicker, Stat } from '../shared/ui';
import { METRICS, eligible, isCorrect, metricValue, nextChallenger, type Guess, type Metric } from './logic';

export function HigherLowerPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.higher-lower.name')} description={t('hl.intro')} />
      <GameLoader>{(d) => <HigherLower data={d} />}</GameLoader>
    </>
  );
}

export function formatMetric(v: number, m: Metric, locale: Locale, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (m) {
    case 'population':
      return v >= 1e6 ? t('hl.units.mln', { v: formatNumber(v / 1e6, locale, v >= 1e8 ? 0 : 1) }) : formatNumber(v, locale);
    case 'gdp':
      return v >= 1e12
        ? t('hl.units.trnUsd', { v: formatNumber(v / 1e12, locale, 2) })
        : t('hl.units.bnUsd', { v: formatNumber(v / 1e9, locale, v >= 1e10 ? 0 : 1) });
    case 'area':
      return `${formatNumber(v, locale)} km²`;
    case 'elevation':
      return `${formatNumber(v, locale)} m`;
  }
}

function HigherLower({ data }: { data: GameData }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<Metric>('population');
  const [run, setRun] = useState(0);
  if (!run) {
    return (
      <ModePicker
        title={t('games.higher-lower.name')}
        intro={t('hl.intro')}
        legend={t('hl.chooseMetric')}
        modes={METRICS.map((id) => ({ id, name: t(`hl.metrics.${id}.name`), desc: t(`hl.metrics.${id}.desc`) }))}
        value={metric}
        onChange={setMetric}
        onStart={() => setRun(1)}
      />
    );
  }
  return <Game key={run} data={data} metric={metric} onRestart={() => setRun((r) => r + 1)} onExit={() => setRun(0)} />;
}

function AnimatedValue({ to, metric }: { to: number; metric: Metric }) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 0.9, ease: 'easeOut', onUpdate: setV });
    return () => c.stop();
  }, [to]);
  return <>{formatMetric(v, metric, locale, t)}</>;
}

function Game({ data, metric, onRestart, onExit }: { data: GameData; metric: Metric; onRestart: () => void; onExit: () => void }) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const record = useProgress((s) => s.record);
  const pool = useMemo(() => eligible(data.countries, metric), [data.countries, metric]);
  const rng = useMemo(() => mulberry32(randomSeed()), []);
  const used = useRef(new Set<string>());
  const [previousBest] = useState(() => bestScore('higher-lower', metric));

  const [pair, setPair] = useState<[Country, Country] | null>(() => {
    const a = pool[Math.floor(rng() * pool.length)]!;
    used.current.add(a.id);
    const b = nextChallenger(a, pool, metric, 0, used.current, rng);
    if (b) used.current.add(b.id);
    return b ? [a, b] : null;
  });
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<{ correct: boolean } | null>(null);
  const [over, setOver] = useState(false);

  const guess = useCallback(
    (g: Guess) => {
      if (!pair || reveal) return;
      const correct = isCorrect(pair[0], pair[1], metric, g);
      setReveal({ correct });
      play(correct ? 'good' : 'bad');
      window.setTimeout(() => {
        if (!correct) {
          setOver(true);
          record({ game: 'higher-lower', variant: metric, score: streak, accuracy: 0 });
          return;
        }
        const s = streak + 1;
        const nxt = nextChallenger(pair[1], pool, metric, s, used.current, rng);
        setStreak(s);
        if (!nxt) {
          setOver(true);
          record({ game: 'higher-lower', variant: metric, score: s, accuracy: 100 });
          return;
        }
        used.current.add(nxt.id);
        setPair([pair[1], nxt]);
        setReveal(null);
      }, 1500);
    },
    [pair, reveal, metric, streak, pool, rng, record],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        guess('higher');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        guess('lower');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guess]);

  if (over || !pair) {
    const isBest = streak > previousBest;
    return (
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{t(`hl.metrics.${metric}.name`)}</p>
        <h1 className="font-display text-4xl sm:text-5xl">{t('quiz.summaryTitle')}</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label={t('hl.streak')}>{streak}</Stat>
          <Stat label={isBest ? t('area.newBest') : t('area.personalBest')}>{Math.max(previousBest, streak)}</Stat>
        </div>
        {pair && (
          <p className="mt-6 text-ink-muted">
            {pair[1].name[locale]}: {formatMetric(metricValue(pair[1], metric)!.value, metric, locale, t)} ·{' '}
            {pair[0].name[locale]}: {formatMetric(metricValue(pair[0], metric)!.value, metric, locale, t)}
          </p>
        )}
        <div className="mt-8 flex gap-3">
          <Button onClick={onRestart} autoFocus>
            {t('quiz.playAgain')}
          </Button>
          <Button variant="secondary" onClick={onExit}>
            {t('quiz.changeMode')}
          </Button>
        </div>
      </div>
    );
  }

  const [known, challenger] = pair;
  const kv = metricValue(known, metric)!;
  const cv = metricValue(challenger, metric)!;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">{t(`hl.metrics.${metric}.name`)}</p>
          <h1 className="font-display text-3xl">{t('games.higher-lower.name')}</h1>
        </div>
        <p className="font-mono text-2xl" aria-live="polite">
          {t('hl.streak')}: {streak}
        </p>
      </div>
      <div className="relative grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={known.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <SideCard country={known} locale={locale}>
              <p className="font-mono text-3xl">{formatMetric(kv.value, metric, locale, t)}</p>
              <Source v={kv} />
            </SideCard>
          </motion.div>
          <motion.div key={challenger.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <SideCard country={challenger} locale={locale} tone={reveal ? (reveal.correct ? 'right' : 'wrong') : undefined}>
              {reveal ? (
                <>
                  <p className="font-mono text-3xl" role="status">
                    <AnimatedValue to={cv.value} metric={metric} />
                  </p>
                  <Source v={cv} />
                </>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button onClick={() => guess('higher')} aria-keyshortcuts="ArrowUp">
                    ▲ {t('hl.higher')}
                  </Button>
                  <Button variant="secondary" onClick={() => guess('lower')} aria-keyshortcuts="ArrowDown">
                    ▼ {t('hl.lower')}
                  </Button>
                </div>
              )}
            </SideCard>
          </motion.div>
        </AnimatePresence>
        <span className="pointer-events-none absolute left-1/2 top-1/2 hidden size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg font-display text-lg italic sm:grid" aria-hidden>
          vs
        </span>
      </div>
      <p className="mt-4 text-center text-sm text-ink-muted">{t('hl.question', { a: challenger.name[locale], b: known.name[locale], metric: t(`hl.metrics.${metric}.name`) })}</p>
      <p className="mt-1 text-center text-xs text-ink-muted">{t('hl.hint')}</p>
    </div>
  );
}

function Source({ v }: { v: { source: string; year?: number } }) {
  const { t } = useTranslation();
  return (
    <p className="mt-1 text-xs text-ink-muted">
      {t('area.source')}: {v.source}
      {v.year ? `, ${v.year}` : ''}
    </p>
  );
}

function SideCard({ country, locale, tone, children }: { country: Country; locale: Locale; tone?: 'right' | 'wrong'; children: React.ReactNode }) {
  const ring = tone === 'right' ? 'ring-2 ring-success' : tone === 'wrong' ? 'ring-2 ring-danger' : '';
  return (
    <Card className={`flex h-full flex-col items-center gap-4 p-6 text-center sm:p-8 ${ring}`}>
      <Flag country={country} decorative className="max-h-24 w-auto max-w-full sm:max-h-28" />
      <h2 className="font-display text-3xl">{country.name[locale]}</h2>
      <div className="min-h-20">{children}</div>
    </Card>
  );
}

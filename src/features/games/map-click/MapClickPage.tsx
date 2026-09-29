import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Seo } from '@/components/ui';
import { Icon } from '@/components/icons';
import { formatNumber } from '@/lib/format';
import { mulberry32, randomSeed } from '@/lib/random';
import { play } from '@/lib/sound';
import { srsWeight, useProgress } from '@/stores/progress';
import { useSettings } from '@/stores/settings';
import { GameLoader, type GameData } from '../shared/GameLoader';
import { CountUp, GameHeader, ModePicker, Stat } from '../shared/ui';
import { MAP_CLASSES, WorldMap } from '../shared/WorldMap';
import { ROUND_MS, centroidDistanceKm, mapPoints, pickTargets, type MapDifficulty } from './logic';

interface RoundResult {
  target: string;
  picked: string;
  correct: boolean;
  km: number;
  points: number;
}

export function MapClickPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.map-click.name')} description={t('map.intro')} />
      <GameLoader needs={{ world: true }}>{(d) => <MapClickGame data={d} />}</GameLoader>
    </>
  );
}

function MapClickGame({ data }: { data: GameData }) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState<MapDifficulty>('easy');
  const [targets, setTargets] = useState<string[] | null>(null);
  const [key, setKey] = useState(0);
  const start = () => {
    setTargets(pickTargets(data.countries, difficulty, mulberry32(randomSeed()), srsWeight('map')));
    setKey((k) => k + 1);
  };
  if (!targets) {
    return (
      <ModePicker
        title={t('games.map-click.name')}
        intro={t('map.intro')}
        legend={t('quiz.chooseMode')}
        modes={(['easy', 'medium', 'hard'] as const).map((id) => ({ id, name: t(`map.difficulty.${id}.name`), desc: t(`map.difficulty.${id}.desc`) }))}
        value={difficulty}
        onChange={setDifficulty}
        onStart={start}
      />
    );
  }
  return <Round key={key} data={data} targets={targets} difficulty={difficulty} onRestart={start} onExit={() => setTargets(null)} />;
}

function Round({
  data,
  targets,
  difficulty,
  onRestart,
  onExit,
}: {
  data: GameData;
  targets: string[];
  difficulty: MapDifficulty;
  onRestart: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const { answer, record } = useProgress();
  const byId = new Map(data.countries.map((c) => [c.id, c]));
  const [i, setI] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const current = results[i];
  const [finished, setFinished] = useState(false);
  const target = byId.get(targets[i]!)!;

  // timer
  const deadline = useRef(0);
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  useEffect(() => {
    if (current) return;
    deadline.current = performance.now() + ROUND_MS;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline.current - performance.now());
      setMsLeft(left);
      if (left <= 0) pick('');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, current]);

  const answered = useRef(-1);
  const pick = useCallback(
    (id: string) => {
      if (answered.current === i) return;
      answered.current = i;
      const correct = id === targets[i];
      const km = correct ? 0 : id ? centroidDistanceKm(data.world, id, targets[i]!) : NaN;
      const points = mapPoints(correct, Math.max(0, deadline.current - performance.now()), km);
      answer('map', targets[i]!, correct);
      play(correct ? 'good' : 'bad');
      setResults((rs) => [...rs, { target: targets[i]!, picked: id, correct, km, points }]);
    },
    [i, targets, data.world, answer],
  );

  const next = useCallback(() => {
    if (i + 1 >= targets.length) {
      setFinished(true);
      const correct = results.filter((r) => r.correct).length;
      record({ game: 'map-click', variant: difficulty, score: results.reduce((s, r) => s + r.points, 0), accuracy: Math.round((correct / results.length) * 100) });
      play('great');
    } else setI(i + 1);
  }, [i, targets.length, results, record, difficulty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && current && !finished && !(e.target instanceof HTMLButtonElement)) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, finished, next]);

  const classFor = useCallback(
    (id: string) => {
      if (current) {
        if (id === current.target) return MAP_CLASSES.correct;
        if (id === current.picked) return MAP_CLASSES.wrong;
        return MAP_CLASSES.muted;
      }
      return MAP_CLASSES.base;
    },
    [current],
  );

  const score = results.reduce((s, r) => s + r.points, 0);

  if (finished) {
    const correct = results.filter((r) => r.correct).length;
    const misses = results.filter((r) => !r.correct);
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl sm:text-5xl">{t('quiz.summaryTitle')}</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label={t('quiz.score')}>
            <CountUp value={score} />
          </Stat>
          <Stat label={t('quiz.correctCount')}>
            {correct}/{results.length}
          </Stat>
        </div>
        {misses.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="font-display text-2xl">{t('quiz.review')}</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {misses.map((r) => (
                <li key={r.target} className="flex justify-between gap-3 py-2">
                  <span className="font-medium">{byId.get(r.target)?.name[locale]}</span>
                  <span className="text-ink-muted">
                    {r.picked ? `${byId.get(r.picked)?.name[locale]} · ${formatNumber(r.km, locale)} km` : t('quiz.timeout')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
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

  return (
    <div>
      <GameHeader
        title={t('games.map-click.name')}
        progress={t('quiz.question', { n: i + 1, total: targets.length })}
        right={<p className="font-mono text-2xl">{score}</p>}
      />
      <Card className="mb-3 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-lg">
          {t('map.find')} <strong className="font-display text-2xl">{target.name[locale]}</strong>
        </p>
        {current ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className={current.correct ? 'text-success' : 'text-danger'}>
              {current.correct
                ? t('quiz.correct', { points: current.points })
                : current.picked
                  ? t('map.missed', { name: byId.get(current.picked)?.name[locale] ?? '', km: formatNumber(current.km, locale), points: current.points })
                  : t('quiz.timeout')}
            </p>
            <Button onClick={next} autoFocus>
              {i + 1 >= targets.length ? t('quiz.results') : t('quiz.next')} <Icon name="arrow-right" />
            </Button>
          </div>
        ) : (
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2" role="timer" aria-label={t('quiz.timeLeft', { s: Math.ceil(msLeft / 1000) })}>
            <div className={`h-full ${msLeft < 5000 ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${(msLeft / ROUND_MS) * 100}%` }} />
          </div>
        )}
      </Card>
      <WorldMap world={data.world} classFor={classFor} onPick={current ? undefined : pick} label={t('map.label')} />
      <p className="mt-2 text-xs text-ink-muted">{t('map.hint')}</p>
    </div>
  );
}

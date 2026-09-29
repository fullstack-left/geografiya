import { useMemo, useRef, useState } from 'react';
import { Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Card, Seo } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { GeoFeature } from '@/data/types';
import { formatNumber } from '@/lib/format';
import { mulberry32, randomSeed, shuffle } from '@/lib/random';
import { play } from '@/lib/sound';
import { useProgress } from '@/stores/progress';
import { useSettings } from '@/stores/settings';
import { GameLoader, type GameData } from '../shared/GameLoader';
import { CountUp, GameHeader, ModePicker, Stat } from '../shared/ui';
import { CATEGORIES, ROUNDS, categoryValue, correctOrder, move, pickRound, rankingScore, type Category } from './logic';

export function FeaturesPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.features.name')} description={t('features.intro')} />
      <GameLoader needs={{ features: true }}>{(d) => <Features data={d} />}</GameLoader>
    </>
  );
}

const UNIT: Record<Category, string> = { rivers: 'km', mountains: 'm', lakeDepth: 'm', lakeArea: 'km²' };

function Features({ data }: { data: GameData }) {
  const { t } = useTranslation();
  const [cat, setCat] = useState<Category>('rivers');
  const [key, setKey] = useState(0);
  if (!key) {
    return (
      <ModePicker
        title={t('games.features.name')}
        intro={t('features.intro')}
        legend={t('quiz.chooseMode')}
        modes={CATEGORIES.map((id) => ({ id, name: t(`features.cat.${id}.name`), desc: t(`features.cat.${id}.desc`) }))}
        value={cat}
        onChange={setCat}
        onStart={() => setKey(1)}
      />
    );
  }
  return <Session key={key} features={data.features} cat={cat} onRestart={() => setKey((k) => k + 1)} onExit={() => setKey(0)} />;
}

function Session({ features, cat, onRestart, onExit }: { features: GeoFeature[]; cat: Category; onRestart: () => void; onExit: () => void }) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const record = useProgress((s) => s.record);
  const rng = useRef(mulberry32(randomSeed())).current;
  const seen = useRef(new Set<string>());

  const newRound = () => {
    const items = pickRound(features, cat, rng, undefined, seen.current);
    const round = items.length >= 3 ? items : pickRound(features, cat, rng);
    round.forEach((f) => seen.current.add(f.id));
    return { items: round, order: shuffle(round.map((f) => f.id), rng) };
  };
  const [round, setRound] = useState(newRound);
  const [n, setN] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const byId = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);
  const truth = useMemo(() => correctOrder(round.items, cat), [round, cat]);

  const confirm = () => {
    const s = rankingScore(round.order, truth);
    setScores((x) => [...x, s]);
    setRevealed(true);
    play(s === 100 ? 'great' : s >= 50 ? 'good' : 'bad');
  };
  const next = () => {
    if (n + 1 >= ROUNDS) {
      const total = scores.reduce((a, b) => a + b, 0);
      record({ game: 'features', variant: cat, score: total, accuracy: Math.round(total / ROUNDS) });
      setDone(true);
      return;
    }
    setN(n + 1);
    setRound(newRound());
    setRevealed(false);
  };

  const fmt = (f: GeoFeature) => `${formatNumber(categoryValue(f, cat)!, locale)} ${UNIT[cat]}`;

  if (done) {
    const total = scores.reduce((a, b) => a + b, 0);
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl sm:text-5xl">{t('quiz.summaryTitle')}</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label={t('quiz.score')}>
            <CountUp value={total} />
          </Stat>
          <Stat label={t('features.perfectRounds')}>
            {scores.filter((s) => s === 100).length}/{ROUNDS}
          </Stat>
        </div>
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

  const setOrder = (order: string[]) => setRound((r) => ({ ...r, order }));
  const last = scores[n];

  return (
    <div className="mx-auto max-w-2xl">
      <GameHeader
        title={t(`features.cat.${cat}.name`)}
        progress={t('quiz.question', { n: n + 1, total: ROUNDS })}
        right={<p className="font-mono text-2xl">{scores.reduce((a, b) => a + b, 0)}</p>}
      />
      <p className="mb-4 text-ink-muted">{t(`features.cat.${cat}.ask`)}</p>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">↑ {t(`features.cat.${cat}.top`)}</p>
      <Reorder.Group axis="y" values={round.order} onReorder={revealed ? () => {} : setOrder} className="space-y-2" aria-label={t('features.listLabel')}>
        {round.order.map((id, i) => {
          const f = byId.get(id)!;
          const right = revealed && truth[i] === id;
          return (
            <Reorder.Item
              key={id}
              value={id}
              dragListener={!revealed}
              className={`flex cursor-grab items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 shadow-card active:cursor-grabbing ${revealed ? (right ? 'border-success' : 'border-danger') : 'border-line'}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-xs">{i + 1}</span>
              <span className="flex-1 font-medium">{f.name[locale]}</span>
              {revealed ? (
                <span className="font-mono text-sm">{fmt(f)}</span>
              ) : (
                <span className="flex gap-1">
                  <button type="button" aria-label={t('features.up', { name: f.name[locale] })} disabled={i === 0} onClick={() => setOrder(move(round.order, i, i - 1))} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" aria-label={t('features.down', { name: f.name[locale] })} disabled={i === round.order.length - 1} onClick={() => setOrder(move(round.order, i, i + 1))} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30">
                    ↓
                  </button>
                </span>
              )}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-accent">↓ {t(`features.cat.${cat}.bottom`)}</p>

      {revealed ? (
        <Card className="mt-4 p-4">
          <p role="status" className={last === 100 ? 'text-success' : 'text-ink'}>
            {t('features.result', { score: last })}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {t('features.correctOrder')}: {truth.map((id) => byId.get(id)!.name[locale]).join(' > ')}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{t('features.sourceNote')}</p>
          <Button className="mt-3" onClick={next} autoFocus>
            {n + 1 >= ROUNDS ? t('quiz.results') : t('quiz.next')} <Icon name="arrow-right" />
          </Button>
        </Card>
      ) : (
        <Button className="mt-6 px-8" onClick={confirm}>
          {t('area.confirm')}
        </Button>
      )}
    </div>
  );
}

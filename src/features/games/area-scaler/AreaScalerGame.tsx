import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Country } from '@/data/types';
import { flagUrl, type WorldTopology } from '@/data/queries';
import { Button, Card } from '@/components/ui';
import { Icon } from '@/components/icons';
import { play } from '@/lib/sound';
import { mulberry32, randomSeed } from '@/lib/random';
import { formatNumber, formatRatio } from '@/lib/format';
import { useSettings } from '@/stores/settings';
import { fitScale, getCountryFeature, linearScaleFor, mainlandFeature, areaKm2, projectShape, trueAreaRatio } from '@/lib/geo/geometry';
import { pickPairs, type Pair } from './pairs';
import { errorPercent, grade, summarize, type Difficulty, type RoundResult } from './scoring';
import { ROUNDS_PER_GAME, initialState, reducer } from './state';
import { MapPanel, Shape } from './components/MapPanel';
import { RatioControls, useRatioText } from './components/Controls';
import { useZoomGestures } from './useGestures';

/** Reference outline occupies this many px of the 400px panel at scale 1. */
const REF_BOX = 190;
/** Anything larger than this is zoomed out (camera) so it stays visible. */
const FIT_BOX = 350;

interface Props {
  countries: Country[];
  world: WorldTopology;
}

export function AreaScalerGame({ countries, world }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const [noPairs, setNoPairs] = useState(false);
  // Stable handlers (dispatch is stable) so gesture listeners are not re-bound mid-pinch.
  const onRatio = useCallback((ratio: number) => dispatch({ type: 'setRatio', ratio }), []);
  const onScaleBy = useCallback((factor: number) => dispatch({ type: 'scaleBy', factor }), []);
  const onConfirm = useCallback((trueRatio: number) => dispatch({ type: 'confirm', trueRatio }), []);
  const onNext = useCallback(() => dispatch({ type: 'next' }), []);

  const start = (difficulty: Difficulty) => {
    const pairs = pickPairs(countries, difficulty, ROUNDS_PER_GAME, mulberry32(randomSeed()))
      // guard against any geometry that fails to resolve
      .filter((p) => getCountryFeature(world, p.referenceId) && getCountryFeature(world, p.targetId));
    setNoPairs(pairs.length === 0);
    dispatch({ type: 'start', difficulty, pairs });
    play('confirm');
  };

  if (state.phase === 'setup') return <Setup onStart={start} noPairs={noPairs} initial={state.difficulty} />;
  if (state.phase === 'summary')
    return (
      <Summary
        results={state.results}
        difficulty={state.difficulty}
        byId={byId}
        onAgain={() => start(state.difficulty)}
        onChange={() => dispatch({ type: 'reset' })}
      />
    );

  const pair = state.pairs[state.round]!;
  return (
    <Board
      key={`${pair.referenceId}-${pair.targetId}`}
      world={world}
      pair={pair}
      reference={byId.get(pair.referenceId)!}
      target={byId.get(pair.targetId)!}
      round={state.round}
      total={state.pairs.length}
      userRatio={state.userRatio}
      revealed={state.phase === 'revealed' ? state.results[state.round]! : null}
      onRatio={onRatio}
      onScaleBy={onScaleBy}
      onConfirm={onConfirm}
      onNext={onNext}
      isLast={state.round === state.pairs.length - 1}
    />
  );
}

// ---------------------------------------------------------------- setup

function Setup({ onStart, noPairs, initial }: { onStart: (d: Difficulty) => void; noPairs: boolean; initial: Difficulty }) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<Difficulty>(initial);
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl sm:text-5xl">{t('area.title')}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t('area.intro')}</p>
      <ProjectionNote />
      <fieldset className="mt-8">
        <legend className="font-mono text-xs uppercase tracking-widest text-accent">{t('area.chooseDifficulty')}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {levels.map((d) => (
            <label
              key={d}
              className={`cursor-pointer rounded-2xl border p-5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${choice === d ? 'border-primary bg-surface shadow-card' : 'border-line bg-surface/60 hover:bg-surface'}`}
            >
              <input type="radio" name="difficulty" value={d} checked={choice === d} onChange={() => setChoice(d)} className="sr-only" />
              <span className="font-display text-xl">{t(`area.difficulty.${d}.name`)}</span>
              <span className="mt-1 block text-sm text-ink-muted">{t(`area.difficulty.${d}.desc`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {noPairs && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {t('area.noPairs')}
        </p>
      )}
      <Button className="mt-8 px-8 py-3 text-base" onClick={() => onStart(choice)}>
        {t('area.start')} <Icon name="arrow-right" />
      </Button>
    </div>
  );
}

function ProjectionNote() {
  const { t } = useTranslation();
  return (
    <details className="mt-6 rounded-2xl border border-line bg-surface/70 p-4 text-sm">
      <summary className="cursor-pointer font-medium">{t('area.projectionTitle')}</summary>
      <p className="mt-2 text-ink-muted">{t('area.projectionBody')}</p>
      <p className="mt-2 text-ink-muted">{t('area.shapeNote')}</p>
    </details>
  );
}

// ---------------------------------------------------------------- board

interface BoardProps {
  world: WorldTopology;
  pair: Pair;
  reference: Country;
  target: Country;
  round: number;
  total: number;
  userRatio: number;
  revealed: RoundResult | null;
  isLast: boolean;
  onRatio: (r: number) => void;
  onScaleBy: (f: number) => void;
  onConfirm: (trueRatio: number) => void;
  onNext: () => void;
}

function Board(p: BoardProps) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const targetRef = useRef<HTMLDivElement>(null);

  const geo = useMemo(() => {
    const refF = mainlandFeature(getCountryFeature(p.world, p.pair.referenceId)!);
    const tgtF = mainlandFeature(getCountryFeature(p.world, p.pair.targetId)!);
    const scale = fitScale(refF, REF_BOX);
    const ref = projectShape(refF, scale, 0, 0);
    const tgt = projectShape(tgtF, scale, 0, 0);
    return {
      scale,
      ref,
      tgt,
      refExt: Math.max(ref.width, ref.height),
      tgtExt: Math.max(tgt.width, tgt.height),
      trueRatio: trueAreaRatio(refF, tgtF),
      refKm2: areaKm2(refF),
      tgtKm2: areaKm2(tgtF),
    };
  }, [p.world, p.pair]);

  const lin = linearScaleFor(p.userRatio, geo.trueRatio);
  // Shared camera zoom: both panels always use the same px/km.
  const zoom = Math.min(1, FIT_BOX / Math.max(geo.refExt, geo.tgtExt * lin));
  const playing = !p.revealed;

  const scaleBy = useCallback(
    (f: number) => {
      p.onScaleBy(f);
      play('tick');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.onScaleBy],
  );
  useZoomGestures(targetRef, playing, scaleBy);

  const confirm = useCallback(() => {
    p.onConfirm(geo.trueRatio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.trueRatio, p.onConfirm]);

  // Keyboard: Enter confirms / advances, +/- scale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault();
        if (playing) confirm();
        else p.onNext();
      } else if (playing && (e.key === '+' || e.key === '=' || (e.key === 'ArrowRight' && tag !== 'INPUT'))) {
        e.preventDefault();
        scaleBy(1.05);
      } else if (playing && (e.key === '-' || e.key === '_' || (e.key === 'ArrowLeft' && tag !== 'INPUT'))) {
        e.preventDefault();
        scaleBy(1 / 1.05);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, confirm, scaleBy, p.onNext]);

  useEffect(() => {
    if (!p.revealed) return;
    const g = grade(p.revealed.accuracy);
    play(g === 'perfect' || g === 'excellent' ? 'great' : g === 'good' || g === 'fair' ? 'good' : 'bad');
  }, [p.revealed]);

  const refName = p.reference.name[locale];
  const tgtName = p.target.name[locale];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            {t('area.round', { n: p.round + 1, total: p.total })}
          </p>
          <h1 className="font-display text-3xl">{t('area.title')}</h1>
        </div>
        <RoundDots current={p.round} total={p.total} />
      </div>

      <AnimatePresence mode="wait">
        {playing ? (
          <motion.div key="play" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <MapPanel label={t('area.reference')} title={refName} accent="ref" barScale={geo.scale * zoom}>
                <Shape d={geo.ref.d} kind="ref" scale={zoom} />
              </MapPanel>
              <MapPanel ref={targetRef} label={t('area.target')} title={tgtName} accent="target" barScale={geo.scale * zoom} className="cursor-zoom-in">
                <Shape d={geo.tgt.d} kind="target" scale={lin * zoom} />
              </MapPanel>
            </div>
            <Card className="mt-4 p-4 sm:p-5">
              <RatioControls ratio={p.userRatio} targetName={tgtName} onRatio={p.onRatio} onScaleBy={scaleBy} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-xs text-ink-muted">{t('area.hint')}</p>
                <Button onClick={confirm} className="px-8">
                  {t('area.confirm')}
                </Button>
              </div>
            </Card>
            <ProjectionNote />
          </motion.div>
        ) : (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Overlay geo={geo} userLin={lin} refName={refName} tgtName={tgtName} />
            <ResultCard
              result={p.revealed!}
              reference={p.reference}
              target={p.target}
              refKm2={geo.refKm2}
              tgtKm2={geo.tgtKm2}
              isLast={p.isLast}
              onNext={p.onNext}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoundDots({ current, total }: { current: number; total: number }) {
  return (
    <ol className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={`h-1.5 w-8 rounded-full ${i < current ? 'bg-primary' : i === current ? 'bg-accent' : 'bg-surface-2'}`} />
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- reveal

function Overlay({
  geo,
  userLin,
  refName,
  tgtName,
}: {
  geo: { scale: number; ref: { d: string }; tgt: { d: string }; refExt: number; tgtExt: number };
  userLin: number;
  refName: string;
  tgtName: string;
}) {
  const { t } = useTranslation();
  const z = Math.min(1, FIT_BOX / Math.max(geo.refExt, geo.tgtExt, geo.tgtExt * userLin));
  return (
    <MapPanel label={t('area.overlay')} title={`${refName} · ${tgtName}`} accent="target" barScale={geo.scale * z}>
      <Shape d={geo.tgt.d} kind="target" scale={userLin * z} dashed />
      <Shape d={geo.ref.d} kind="ref" scale={z} />
      <Shape d={geo.tgt.d} kind="target" scale={z} from={userLin * z} />
    </MapPanel>
  );
}

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [value]);
  return (
    <>
      {v}
      {suffix}
    </>
  );
}

function ResultCard({
  result,
  reference,
  target,
  refKm2,
  tgtKm2,
  isLast,
  onNext,
}: {
  result: RoundResult;
  reference: Country;
  target: Country;
  refKm2: number;
  tgtKm2: number;
  isLast: boolean;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const ratioText = useRatioText();
  const g = grade(result.accuracy);
  const err = errorPercent(result.userRatio, result.trueRatio);
  const tone = g === 'miss' ? 'text-danger' : g === 'fair' ? 'text-warning' : 'text-success';
  const km2 = (n: number) => `${formatNumber(n, locale)} ${t('area.km2')}`;

  return (
    <Card className="flex flex-col p-6">
      <p className={`font-display text-3xl ${tone}`} role="status">
        {t(`area.grade.${g}`)}
      </p>
      <div className="mt-4 flex items-end gap-6">
        <div>
          <p className="font-mono text-6xl leading-none">
            <CountUp value={result.accuracy} suffix="%" />
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest text-ink-muted">{t('area.accuracy')}</p>
        </div>
        <div>
          <p className="font-mono text-3xl leading-none text-accent">
            +<CountUp value={result.points} />
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest text-ink-muted">{t('area.points')}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <dt className="text-ink-muted">{t('area.trueRatio')}</dt>
        <dd className="text-right font-mono">
          ×{formatRatio(result.trueRatio, locale)} <span className="text-ink-muted">({ratioText(result.trueRatio)})</span>
        </dd>
        <dt className="text-ink-muted">{t('area.yourGuess')}</dt>
        <dd className="text-right font-mono">×{formatRatio(result.userRatio, locale)}</dd>
        <dt className="text-ink-muted">{t('area.error')}</dt>
        <dd className="text-right font-mono">
          {err >= 0 ? '+' : ''}
          {formatNumber(err, locale, 1)}%
        </dd>
      </dl>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { c: reference, km: refKm2, cls: 'border-shape-ref' },
          { c: target, km: tgtKm2, cls: 'border-shape-target' },
        ].map(({ c, km, cls }) => (
          <div key={c.id} className={`rounded-2xl border-l-4 bg-bg p-3 ${cls}`}>
            <p className="font-medium">
              <img src={flagUrl(c)} alt="" width={20} height={14} loading="lazy" className="mr-1.5 inline-block h-3.5 w-5 rounded-sm object-cover align-[-1px] ring-1 ring-line" />
              {c.name[locale]}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t('area.areaOfficial')}: <span className="font-mono text-ink">{km2(c.area.value)}</span>
              <span className="block">
                {t('area.source')}: {c.area.source}
                {c.area.year ? `, ${c.area.year}` : ''}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t('area.areaShape')}: <span className="font-mono text-ink">{km2(km)}</span>
            </p>
          </div>
        ))}
      </div>

      <Button className="mt-6 self-end px-8" onClick={onNext} autoFocus>
        {isLast ? t('area.finish') : t('area.next')} <Icon name="arrow-right" />
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------- summary

const bestKey = (d: Difficulty) => `geomaster-area-best-${d}`;

function Summary({
  results,
  difficulty,
  byId,
  onAgain,
  onChange,
}: {
  results: RoundResult[];
  difficulty: Difficulty;
  byId: Map<string, Country>;
  onAgain: () => void;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const { total, avgAccuracy } = summarize(results);
  const [{ best, isNew }] = useState(() => {
    const prev = Number(localStorage.getItem(bestKey(difficulty)) ?? 0);
    if (total > prev) localStorage.setItem(bestKey(difficulty), String(total));
    return { best: Math.max(prev, total), isNew: total > prev };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">{t(`area.difficulty.${difficulty}.name`)}</p>
      <h1 className="font-display text-4xl sm:text-5xl">{t('area.summaryTitle')}</h1>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Card className="p-5">
          <p className="font-mono text-4xl">
            <CountUp value={total} />
          </p>
          <p className="text-xs text-ink-muted">{t('area.total')}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-4xl">
            <CountUp value={avgAccuracy} suffix="%" />
          </p>
          <p className="text-xs text-ink-muted">{t('area.avgAccuracy')}</p>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-4xl">{best}</p>
          <p className="text-xs text-ink-muted">{isNew ? t('area.newBest') : t('area.personalBest')}</p>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">
                {t('area.reference')} – {t('area.target')}
              </th>
              <th className="px-4 py-2 text-right">{t('area.trueRatio')}</th>
              <th className="px-4 py-2 text-right">{t('area.yourGuess')}</th>
              <th className="px-4 py-2 text-right">{t('area.accuracy')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2 font-mono text-ink-muted">{i + 1}</td>
                <td className="px-4 py-2">
                  {byId.get(r.referenceId)?.name[locale]} – {byId.get(r.targetId)?.name[locale]}
                </td>
                <td className="px-4 py-2 text-right font-mono">×{formatRatio(r.trueRatio, locale)}</td>
                <td className="px-4 py-2 text-right font-mono">×{formatRatio(r.userRatio, locale)}</td>
                <td className="px-4 py-2 text-right font-mono">{r.accuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onAgain} autoFocus>
          {t('area.playAgain')}
        </Button>
        <Button variant="secondary" onClick={onChange}>
          {t('area.changeDifficulty')}
        </Button>
      </div>
    </div>
  );
}

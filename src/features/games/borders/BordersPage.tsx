import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Card, Seo } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { Country } from '@/data/types';
import { mulberry32, randomSeed } from '@/lib/random';
import { play } from '@/lib/sound';
import { useProgress } from '@/stores/progress';
import { useSettings } from '@/stores/settings';
import { CountryCombobox } from '../shared/CountryCombobox';
import { GameLoader, type GameData } from '../shared/GameLoader';
import { CountUp, Flag, GameHeader, ModePicker, Stat } from '../shared/ui';
import { MAP_CLASSES, WorldMap } from '../shared/WorldMap';
import { buildGraph, chainScore, hint, pickPuzzles, shortestPath, step, type ChainDifficulty, type Graph, type Puzzle } from './logic';

const PUZZLES = 5;

export function BordersPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.borders.name')} description={t('borders.intro')} />
      <GameLoader needs={{ world: true }}>{(d) => <Borders data={d} />}</GameLoader>
    </>
  );
}

function Borders({ data }: { data: GameData }) {
  const { t } = useTranslation();
  const graph = useMemo(() => buildGraph(data.countries), [data.countries]);
  const [difficulty, setDifficulty] = useState<ChainDifficulty>('easy');
  const [run, setRun] = useState<{ key: number; puzzles: Puzzle[] } | null>(null);
  const start = () => setRun({ key: Date.now(), puzzles: pickPuzzles(graph, difficulty, PUZZLES, mulberry32(randomSeed())) });

  if (!run) {
    return (
      <ModePicker
        title={t('games.borders.name')}
        intro={t('borders.intro')}
        legend={t('quiz.chooseMode')}
        modes={(['easy', 'medium', 'hard'] as const).map((id) => ({ id, name: t(`borders.difficulty.${id}.name`), desc: t(`borders.difficulty.${id}.desc`) }))}
        value={difficulty}
        onChange={setDifficulty}
        onStart={start}
      />
    );
  }
  return <Session key={run.key} data={data} graph={graph} puzzles={run.puzzles} difficulty={difficulty} onRestart={start} onExit={() => setRun(null)} />;
}

interface Solved {
  puzzle: Puzzle;
  chain: string[];
  score: number;
  gaveUp: boolean;
}

function Session({
  data,
  graph,
  puzzles,
  difficulty,
  onRestart,
  onExit,
}: {
  data: GameData;
  graph: Graph;
  puzzles: Puzzle[];
  difficulty: ChainDifficulty;
  onRestart: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const record = useProgress((s) => s.record);
  const byId = useMemo(() => new Map(data.countries.map((c) => [c.id, c])), [data.countries]);
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState<Solved[]>([]);
  const [finished, setFinished] = useState(false);

  const puzzle = puzzles[i];
  const [chain, setChain] = useState<string[]>(() => (puzzle ? [puzzle.start] : []));
  const [wrong, setWrong] = useState(0);
  const [hints, setHints] = useState(0);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const current = solved[i];
  const name = (id: string) => byId.get(id)?.name[locale] ?? id;

  const finishPuzzle = (finalChain: string[], gaveUp: boolean) => {
    if (!puzzle) return;
    const used = finalChain.length - 1;
    const score = gaveUp ? 0 : chainScore(puzzle.optimal, used, wrong, hints);
    setSolved((s) => [...s, { puzzle, chain: finalChain, score, gaveUp }]);
    play(gaveUp ? 'bad' : score === 100 ? 'great' : 'good');
  };

  const onSelect = (c: Country) => {
    if (!puzzle || current) return;
    const r = step(graph, chain, puzzle.target, c.id);
    const end = name(chain[chain.length - 1]!);
    if (r === 'ok' || r === 'reached') {
      const next = [...chain, c.id];
      setChain(next);
      setMessage({ tone: 'ok', text: t('borders.added', { name: c.name[locale] }) });
      play('tick');
      if (r === 'reached') finishPuzzle(next, false);
    } else {
      setWrong((w) => w + (r === 'not-neighbour' ? 1 : 0));
      setMessage({ tone: 'bad', text: t(`borders.errors.${r}`, { name: c.name[locale], end }) });
      play('bad');
    }
  };

  const undo = () => {
    if (chain.length > 1 && !current) setChain(chain.slice(0, -1));
  };
  const useHint = () => {
    if (!puzzle || current) return;
    const h = hint(graph, chain, puzzle.target);
    if (!h) return;
    setHints((n) => n + 1);
    setMessage({ tone: 'ok', text: t('borders.hintText', { name: name(h) }) });
  };

  const next = () => {
    if (i + 1 >= puzzles.length) {
      setFinished(true);
      const total = solved.reduce((s, x) => s + x.score, 0);
      record({ game: 'borders', variant: difficulty, score: total, accuracy: Math.round(total / puzzles.length) });
      return;
    }
    const p = puzzles[i + 1]!;
    setI(i + 1);
    setChain([p.start]);
    setWrong(0);
    setHints(0);
    setMessage(null);
  };

  const optimalPath = useMemo(() => (puzzle ? shortestPath(graph, puzzle.start, puzzle.target) ?? [] : []), [graph, puzzle]);
  const classFor = useCallback(
    (id: string) => {
      if (!puzzle) return MAP_CLASSES.muted;
      if (id === puzzle.start) return MAP_CLASSES.ref;
      if (id === puzzle.target) return MAP_CLASSES.target;
      if (chain.includes(id)) return MAP_CLASSES.chain;
      if (current && optimalPath.includes(id)) return 'fill-accent/40 stroke-accent';
      if (!graph.has(id)) return MAP_CLASSES.outOfPlay;
      return MAP_CLASSES.muted;
    },
    [puzzle, chain, current, optimalPath, graph],
  );
  const focus = useMemo(() => (puzzle ? [puzzle.start, puzzle.target] : []), [puzzle]);

  if (finished || !puzzle) {
    const total = solved.reduce((s, x) => s + x.score, 0);
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl sm:text-5xl">{t('quiz.summaryTitle')}</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label={t('quiz.score')}>
            <CountUp value={total} />
          </Stat>
          <Stat label={t('borders.perfect')}>
            {solved.filter((s) => s.score === 100).length}/{solved.length}
          </Stat>
        </div>
        <Card className="mt-6 divide-y divide-line p-2">
          {solved.map((s) => (
            <div key={s.puzzle.start} className="p-4 text-sm">
              <p className="font-medium">
                {name(s.puzzle.start)} → {name(s.puzzle.target)} <span className="font-mono text-ink-muted">· {s.score}</span>
              </p>
              <p className="text-ink-muted">
                {t('borders.yours')}: {s.chain.map(name).join(' → ')}
              </p>
              <p className="text-ink-muted">
                {t('borders.shortest')} ({s.puzzle.optimal}): {(shortestPath(graph, s.puzzle.start, s.puzzle.target) ?? []).map(name).join(' → ')}
              </p>
            </div>
          ))}
        </Card>
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

  const start = byId.get(puzzle.start)!;
  const target = byId.get(puzzle.target)!;

  return (
    <div>
      <GameHeader
        title={t('games.borders.name')}
        progress={t('quiz.question', { n: i + 1, total: puzzles.length })}
        right={<p className="font-mono text-2xl">{solved.reduce((s, x) => s + x.score, 0)}</p>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <WorldMap world={data.world} classFor={classFor} focusIds={focus} label={t('borders.mapLabel')} className="self-start" />
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <Flag country={start} decorative className="h-8 w-12 object-cover" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-shape-ref">{t('borders.from')}</p>
              <p className="font-display text-xl">{start.name[locale]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Flag country={target} decorative className="h-8 w-12 object-cover" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-shape-target">{t('borders.to')}</p>
              <p className="font-display text-xl">{target.name[locale]}</p>
            </div>
          </div>
          <p className="text-sm text-ink-muted">{t('borders.optimalHint', { n: puzzle.optimal })}</p>

          <ol className="flex flex-wrap items-center gap-1.5 text-sm" aria-label={t('borders.chain')}>
            {chain.map((id, k) => (
              <motion.li key={id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5">
                {k > 0 && <span className="text-ink-muted" aria-hidden>→</span>}
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{name(id)}</span>
              </motion.li>
            ))}
          </ol>

          {current ? (
            <div role="status">
              <p className={current.gaveUp ? 'text-danger' : 'text-success'}>
                {current.gaveUp ? t('borders.gaveUp') : t('borders.reached', { score: current.score })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t('borders.shortest')}: {optimalPath.map(name).join(' → ')}
              </p>
              <Button className="mt-4 w-full" onClick={next} autoFocus>
                {i + 1 >= puzzles.length ? t('quiz.results') : t('quiz.next')} <Icon name="arrow-right" />
              </Button>
            </div>
          ) : (
            <>
              <CountryCombobox countries={data.countries} onSelect={onSelect} placeholder={t('borders.inputLabelFrom', { name: name(chain[chain.length - 1]!) })} />
              {message && (
                <p role="status" className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
                  {message.text}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={undo} disabled={chain.length < 2}>
                  {t('borders.undo')}
                </Button>
                <Button variant="secondary" onClick={useHint}>
                  {t('borders.hint')}
                </Button>
                <Button variant="ghost" onClick={() => finishPuzzle(chain, true)}>
                  {t('borders.giveUp')}
                </Button>
              </div>
              <p className="text-xs text-ink-muted">
                {t('borders.penalties', { wrong, hints })}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

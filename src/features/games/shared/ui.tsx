import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui';
import { Icon } from '@/components/icons';
import { flagUrl, type WorldTopology } from '@/data/queries';
import type { Country } from '@/data/types';
import { fitScale, getCountryFeature, mainlandFeature, projectShape } from '@/lib/geo/geometry';

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 1, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [value]);
  return (
    <>
      {v}
      {suffix}
    </>
  );
}

export function Flag({ country, className = '', decorative = false }: { country: Country; className?: string; decorative?: boolean }) {
  const { t } = useTranslation();
  return (
    <img
      src={flagUrl(country)}
      alt={decorative ? '' : t('quiz.flagAlt')}
      draggable={false}
      className={`rounded-md object-contain shadow-card ring-1 ring-line ${className}`}
    />
  );
}

/** A country outline fitted into a square box (equal-area, centred on itself). */
export function CountryShape({
  world,
  countryId,
  size = 260,
  className = '',
  label,
}: {
  world: WorldTopology;
  countryId: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const d = useMemo(() => {
    const f = getCountryFeature(world, countryId);
    if (!f) return '';
    const m = mainlandFeature(f);
    return projectShape(m, fitScale(m, size * 0.86), size / 2, size / 2).d;
  }, [world, countryId, size]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label}>
      <path d={d} className="fill-shape-target-fill stroke-shape-target" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function GameHeader({ title, progress, right }: { title: string; progress?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {progress && <p className="font-mono text-xs uppercase tracking-widest text-accent">{progress}</p>}
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="font-mono text-3xl sm:text-4xl">{children}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </Card>
  );
}

/** Generic "choose a mode" intro screen used by several games. */
export function ModePicker<T extends string>({
  title,
  intro,
  legend,
  modes,
  value,
  onChange,
  onStart,
  children,
}: {
  title: string;
  intro: string;
  legend: string;
  modes: { id: T; name: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
  onStart: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 text-lg text-ink-muted">{intro}</p>
      <fieldset className="mt-8">
        <legend className="font-mono text-xs uppercase tracking-widest text-accent">{legend}</legend>
        <div className={`mt-3 grid gap-3 ${modes.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {modes.map((m) => (
            <label
              key={m.id}
              className={`cursor-pointer rounded-2xl border p-5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${value === m.id ? 'border-primary bg-surface shadow-card' : 'border-line bg-surface/60 hover:bg-surface'}`}
            >
              <input type="radio" name="mode" value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} className="sr-only" />
              <span className="font-display text-xl">{m.name}</span>
              {m.desc && <span className="mt-1 block text-sm text-ink-muted">{m.desc}</span>}
            </label>
          ))}
        </div>
      </fieldset>
      {children}
      <Button className="mt-8 px-8 py-3 text-base" onClick={onStart}>
        {t('common.start')} <Icon name="arrow-right" />
      </Button>
    </div>
  );
}

/** Normalise for forgiving text matching: case, diacritics, apostrophes, hyphens. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ʻʼ'‘’`]/g, '')
    .replace(/[-–—.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

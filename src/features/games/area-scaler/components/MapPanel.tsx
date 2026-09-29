import { animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { niceScaleBar } from '@/lib/geo/geometry';
import { formatNumber } from '@/lib/format';
import { useSettings } from '@/stores/settings';

export const VIEW = 400;
const HALF = VIEW / 2;

export type ShapeKind = 'ref' | 'target';

const kindClass: Record<ShapeKind, string> = {
  ref: 'fill-shape-ref-fill stroke-shape-ref',
  target: 'fill-shape-target-fill stroke-shape-target',
};

/**
 * A pre-projected path (centred at 0,0) drawn at `scale` × its base size.
 * Scaling via transform keeps slider interaction cheap and smooth.
 */
export function Shape({ d, kind, scale, from, dashed }: { d: string; kind: ShapeKind; scale: number; from?: number; dashed?: boolean }) {
  const k = useAnimatedScale(scale, from);
  return (
    <g transform={`translate(${HALF} ${HALF}) scale(${k})`}>
      <path
        d={d}
        className={kindClass[kind]}
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={dashed ? '5 4' : undefined}
      />
    </g>
  );
}

/**
 * Follows `target` immediately during interaction; when `from` is given the
 * value springs from `from` to `target` once (used for the reveal).
 */
function useAnimatedScale(target: number, from?: number): number {
  const [value, setValue] = useState(from ?? target);
  const animated = from !== undefined;
  useEffect(() => {
    if (!animated) return;
    const controls = animate(from, target, {
      type: 'spring',
      stiffness: 55,
      damping: 13,
      delay: 0.3,
      onUpdate: setValue,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animated]);
  return animated ? value : target;
}

function ScaleBar({ scale }: { scale: number }) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const { km, px } = niceScaleBar(scale, 110);
  return (
    <g transform={`translate(16 ${VIEW - 18})`} aria-label={`${t('area.scaleBar')}: ${km} ${t('area.km')}`} role="img">
      <line x1={0} x2={px} y1={0} y2={0} className="stroke-ink" strokeWidth={2} />
      <line x1={0} x2={0} y1={-4} y2={4} className="stroke-ink" strokeWidth={2} />
      <line x1={px} x2={px} y1={-4} y2={4} className="stroke-ink" strokeWidth={2} />
      <text x={px + 6} y={4} className="fill-ink-muted font-mono text-[13px]">
        {formatNumber(km, locale)} {t('area.km')}
      </text>
    </g>
  );
}

interface PanelProps {
  label: string;
  title: string;
  accent: ShapeKind;
  /** px per Earth radius for the scale bar; omit to hide. */
  barScale?: number;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export const MapPanel = forwardRef<HTMLDivElement, PanelProps>(function MapPanel(
  { label, title, accent, barScale, children, className = '', footer },
  ref,
) {
  return (
    <figure className={`relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card ${className}`}>
      <figcaption className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${accent === 'ref' ? 'text-shape-ref' : 'text-shape-target'}`}>
          {label}
        </span>
        <p className="font-display text-sm leading-tight sm:text-2xl">{title}</p>
      </figcaption>
      <div ref={ref} className="bg-graticule aspect-square w-full touch-none select-none">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="size-full overflow-hidden" role="img" aria-label={title}>
          {children}
          {barScale !== undefined && <ScaleBar scale={barScale} />}
        </svg>
      </div>
      {footer}
    </figure>
  );
});

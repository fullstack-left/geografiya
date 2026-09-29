import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useTranslation } from 'react-i18next';
import type { WorldTopology } from '@/data/queries';
import { Icon } from '@/components/icons';

const W = 960;
const H = 520;

export type CountryPaths = { id: string; d: string }[];

/**
 * World map on the Equal Earth projection (equal-area, so sizes are honest).
 * Supports wheel / pinch zoom and drag-to-pan; a click that did not drag
 * calls `onPick(countryId)`.
 */
export function WorldMap({
  world,
  classFor,
  onPick,
  focusIds,
  interactive = true,
  label,
  className = '',
}: {
  world: WorldTopology;
  classFor: (id: string) => string;
  onPick?: (id: string) => void;
  /** Fit the projection to these countries instead of the whole world. */
  focusIds?: string[];
  interactive?: boolean;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const focusKey = focusIds?.join(',') ?? '';
  const paths = useMemo(() => {
    const fc = feature(world, world.objects.countries) as FeatureCollection<Geometry>;
    const all = fc.features.filter((f) => typeof f.id === 'string' && !String(f.id).startsWith('X-'));
    const focus = focusIds?.length ? all.filter((f) => focusIds.includes(String(f.id))) : [];
    const projection = geoEqualEarth();
    if (focus.length) projection.fitExtent([[24, 24], [W - 24, H - 24]], { type: 'FeatureCollection', features: focus } as FeatureCollection);
    else projection.fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' } as unknown as Feature);
    const path = geoPath(projection);
    return {
      countries: all.map((f) => ({ id: String(f.id), d: path(f) ?? '' })),
      sphere: path({ type: 'Sphere' } as unknown as Feature) ?? '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, focusKey]);

  // ---- zoom / pan state
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [focusKey]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !interactive) return;
    const toLocal = (cx: number, cy: number) => {
      const r = svg.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
    };
    const zoomAt = (factor: number, px: number, py: number) =>
      setView((v) => {
        const k = Math.min(40, Math.max(1, v.k * factor));
        const f = k / v.k;
        return clamp({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
      });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.0025), p.x, p.y);
    };
    const pts = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number; d: number } | null = null;
    let moved = 0;
    const centre = () => {
      const a = [...pts.values()];
      const x = a.reduce((s, p) => s + p.x, 0) / a.length;
      const y = a.reduce((s, p) => s + p.y, 0) / a.length;
      const d = a.length === 2 ? Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y) : 0;
      return { x, y, d };
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, toLocal(e.clientX, e.clientY));
      last = centre();
      if (pts.size === 1) moved = 0;
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !last) return;
      pts.set(e.pointerId, toLocal(e.clientX, e.clientY));
      const c = centre();
      moved += Math.hypot(c.x - last.x, c.y - last.y);
      if (pts.size === 2 && last.d > 0 && c.d > 0) zoomAt(c.d / last.d, c.x, c.y);
      const dx = c.x - last.x;
      const dy = c.y - last.y;
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
      last = c;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      last = pts.size ? centre() : null;
      if (pts.size === 0 && moved > 6) {
        // swallow the click that ends a drag
        const stop = (ev: Event) => ev.stopPropagation();
        svg.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => svg.removeEventListener('click', stop, { capture: true }), 0);
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [interactive]);

  const zoomBtn = (factor: number) =>
    setView((v) => {
      const k = Math.min(40, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clamp({ k, x: W / 2 - (W / 2 - v.x) * f, y: H / 2 - (H / 2 - v.y) * f });
    });

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`block w-full touch-none select-none ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
        role="img"
        aria-label={label}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={paths.sphere} className="fill-bg stroke-line" vectorEffect="non-scaling-stroke" />
          <Countries paths={paths.countries} classFor={classFor} onPick={onPick} />
        </g>
      </svg>
      {interactive && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button type="button" aria-label={t('map.zoomIn')} onClick={() => zoomBtn(1.6)} className="grid size-9 place-items-center rounded-full border border-line bg-surface text-lg shadow-card">
            +
          </button>
          <button type="button" aria-label={t('map.zoomOut')} onClick={() => zoomBtn(1 / 1.6)} className="grid size-9 place-items-center rounded-full border border-line bg-surface text-lg shadow-card">
            −
          </button>
          <button type="button" aria-label={t('map.reset')} onClick={() => setView({ k: 1, x: 0, y: 0 })} className="grid size-9 place-items-center rounded-full border border-line bg-surface text-sm shadow-card">
            <Icon name="reset" />
          </button>
        </div>
      )}
    </div>
  );
}

function clamp(v: { k: number; x: number; y: number }) {
  // keep at least part of the map in view
  const minX = W - W * v.k;
  const minY = H - H * v.k;
  return { k: v.k, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
}

const Countries = memo(function Countries({
  paths,
  classFor,
  onPick,
}: {
  paths: CountryPaths;
  classFor: (id: string) => string;
  onPick?: (id: string) => void;
}) {
  return (
    <>
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          data-id={p.id}
          className={`transition-colors ${classFor(p.id)} ${onPick ? 'cursor-pointer' : ''}`}
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
          onClick={onPick ? () => onPick(p.id) : undefined}
        />
      ))}
    </>
  );
});

export const MAP_CLASSES = {
  base: 'fill-surface-2 stroke-line hover:fill-shape-target-fill',
  muted: 'fill-surface-2 stroke-line',
  correct: 'fill-success stroke-success',
  wrong: 'fill-danger stroke-danger',
  target: 'fill-shape-target stroke-shape-target',
  ref: 'fill-shape-ref stroke-shape-ref',
  chain: 'fill-accent stroke-accent',
  outOfPlay: 'fill-surface-2/40 stroke-line/60',
} as const;

import { useTranslation } from 'react-i18next';
import { MAX_RATIO, MIN_RATIO } from '../scoring';
import { formatRatio } from '@/lib/format';
import { useSettings } from '@/stores/settings';

export function useRatioText() {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  return (r: number) => {
    if (Math.abs(Math.log(r)) < 0.005) return t('area.same');
    return r >= 1
      ? t('area.timesBigger', { x: formatRatio(r, locale) })
      : t('area.timesSmaller', { x: formatRatio(1 / r, locale) });
  };
}

const STEP = 1.05;

export function RatioControls({
  ratio,
  targetName,
  onRatio,
  onScaleBy,
}: {
  ratio: number;
  targetName: string;
  onRatio: (r: number) => void;
  onScaleBy: (f: number) => void;
}) {
  const { t } = useTranslation();
  const ratioText = useRatioText();
  const text = ratioText(ratio);
  const btn =
    'grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-xl font-semibold transition hover:bg-surface-2 active:scale-95';

  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} aria-label={t('area.zoomOut')} onClick={() => onScaleBy(1 / STEP)}>
        −
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="gm-range"
          min={Math.log(MIN_RATIO)}
          max={Math.log(MAX_RATIO)}
          step={0.001}
          value={Math.log(ratio)}
          onChange={(e) => onRatio(Math.exp(Number(e.target.value)))}
          aria-label={t('area.sliderLabel', { name: targetName })}
          aria-valuetext={text}
        />
      </div>
      <button type="button" className={btn} aria-label={t('area.zoomIn')} onClick={() => onScaleBy(STEP)}>
        +
      </button>
      <output aria-live="polite" className="w-20 shrink-0 text-right font-mono text-xs sm:w-36 sm:text-sm">
        {text}
      </output>
    </div>
  );
}

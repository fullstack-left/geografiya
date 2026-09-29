import { useTranslation } from 'react-i18next';
import { Card, ErrorState, Seo, Skeleton } from '@/components/ui';
import { useManifest } from '@/data/queries';
import { useSettings } from '@/stores/settings';
import { formatDate, formatNumber } from '@/lib/format';

export function DataPage() {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const { data: m, isPending, isError, refetch, error } = useManifest();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Seo title={t('data.title')} description={t('data.intro')} />
      <h1 className="font-display text-4xl">{t('data.title')}</h1>
      <p className="text-ink-muted">{t('data.intro')}</p>

      {isPending && <Skeleton className="h-64" />}
      {isError && <ErrorState detail={error.message} onRetry={() => void refetch()} />}
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t('data.countries'), m.stats.countries],
              [t('data.withGeometry'), m.stats.withGeometry],
              [t('data.withPopulation'), m.stats.withPopulation],
              [t('data.discrepancies'), m.stats.areaDiscrepancies],
            ].map(([label, v]) => (
              <Card key={label} className="p-4">
                <p className="font-mono text-2xl">{formatNumber(Number(v), locale)}</p>
                <p className="text-xs text-ink-muted">{label}</p>
              </Card>
            ))}
          </div>
          <p className="font-mono text-xs text-ink-muted">
            {t('data.version')} v{m.version} · {t('data.generated')} {formatDate(m.generatedAt, locale)}
          </p>

          <Card className="p-6">
            <h2 className="font-display text-2xl">{t('data.sources')}</h2>
            <ul className="mt-4 divide-y divide-line">
              {m.sources.map((s) => (
                <li key={s.id} className="py-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline decoration-dotted underline-offset-4">
                    {s.name}
                  </a>
                  <p className="text-xs text-ink-muted">
                    {t('data.license')}: {s.license} · {formatDate(s.fetchedAt, locale)}
                    {s.upstreamUpdated && ` · upstream ${s.upstreamUpdated}`}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-2xl">{t('data.reconciliation')}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t('data.reconciliationBody')}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t('data.warnings')} ({m.warnings.length})
              </summary>
              <ul className="mt-3 max-h-80 space-y-1 overflow-auto font-mono text-xs text-ink-muted">
                {m.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}

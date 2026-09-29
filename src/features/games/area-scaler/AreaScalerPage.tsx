import { useTranslation } from 'react-i18next';
import { ErrorState, Seo, Skeleton } from '@/components/ui';
import { usePlayableCountries, useWorld } from '@/data/queries';
import { AreaScalerGame } from './AreaScalerGame';

export function AreaScalerPage() {
  const { t } = useTranslation();
  const countries = usePlayableCountries();
  const world = useWorld();

  return (
    <>
      <Seo title={t('area.title')} description={t('area.seoDesc')} />
      {(countries.isPending || world.isPending) && !(countries.isError || world.isError) && (
        <div aria-busy="true" aria-label={t('common.loading')}>
          <Skeleton className="h-10 w-64" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Skeleton className="aspect-square" />
            <Skeleton className="aspect-square" />
          </div>
        </div>
      )}
      {(countries.isError || world.isError) && (
        <ErrorState
          detail={(countries.error ?? world.error)?.message}
          onRetry={() => {
            void countries.refetch();
            void world.refetch();
          }}
        />
      )}
      {countries.data && world.data && <AreaScalerGame countries={countries.data} world={world.data} />}
    </>
  );
}

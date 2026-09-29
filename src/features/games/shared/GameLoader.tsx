import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, Skeleton } from '@/components/ui';
import { useFeatures, usePlayableCountries, useWorld, type WorldTopology } from '@/data/queries';
import type { Country, GeoFeature } from '@/data/types';

export interface GameData {
  countries: Country[];
  world: WorldTopology;
  features: GeoFeature[];
}

/**
 * Loads the static datasets a game needs and shows skeleton / error states.
 * Unrequested datasets are passed as empty/undefined-safe placeholders.
 */
export function GameLoader({
  needs = { world: false, features: false },
  children,
}: {
  needs?: { world?: boolean; features?: boolean };
  children: (d: GameData) => ReactNode;
}) {
  const { t } = useTranslation();
  const countries = usePlayableCountries();
  const world = useWorld();
  const features = useFeatures();
  const queries = [countries, ...(needs.world ? [world] : []), ...(needs.features ? [features] : [])];
  const failed = queries.find((q) => q.isError);

  if (failed) {
    return <ErrorState detail={failed.error?.message} onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }
  if (queries.some((q) => !q.data)) {
    return (
      <div aria-busy="true" aria-label={t('common.loading')}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-80" />
      </div>
    );
  }
  return (
    <>
      {children({
        countries: countries.data!,
        world: (world.data ?? { type: 'Topology', objects: { countries: { type: 'GeometryCollection', geometries: [] } }, arcs: [] }) as WorldTopology,
        features: features.data ?? [],
      })}
    </>
  );
}

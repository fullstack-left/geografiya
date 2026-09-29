import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { lazy, Suspense, type ComponentType } from 'react';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import type { GameId } from '@/features/games/registry';

// Every game module & secondary page is its own code-split chunk.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const GAME_PAGES: Record<GameId, ComponentType> = {
  'area-scaler': page(() => import('@/features/games/area-scaler/AreaScalerPage'), 'AreaScalerPage'),
  capitals: page(() => import('@/features/games/capitals/CapitalsPage'), 'CapitalsPage'),
  flags: page(() => import('@/features/games/flags/FlagsPage'), 'FlagsPage'),
  'map-click': page(() => import('@/features/games/map-click/MapClickPage'), 'MapClickPage'),
  shapes: page(() => import('@/features/games/shapes/ShapesPage'), 'ShapesPage'),
  'higher-lower': page(() => import('@/features/games/higher-lower/HigherLowerPage'), 'HigherLowerPage'),
  borders: page(() => import('@/features/games/borders/BordersPage'), 'BordersPage'),
  features: page(() => import('@/features/games/features/FeaturesPage'), 'FeaturesPage'),
  daily: page(() => import('@/features/games/daily/DailyPage'), 'DailyPage'),
};
const SettingsPage = page(() => import('@/pages/SettingsPage'), 'SettingsPage');
const DataPage = page(() => import('@/pages/DataPage'), 'DataPage');

const withSuspense = (C: ComponentType) => () => (
  <Suspense fallback={<Skeleton className="h-96" />}>
    <C />
  </Suspense>
);

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: NotFoundPage });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  ...(Object.entries(GAME_PAGES) as [GameId, ComponentType][]).map(([id, C]) =>
    createRoute({ getParentRoute: () => rootRoute, path: `/play/${id}`, component: withSuspense(C) }),
  ),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: withSuspense(SettingsPage) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/data', component: withSuspense(DataPage) }),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

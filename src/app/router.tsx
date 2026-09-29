import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Game modules & secondary pages are code-split.
const AreaScalerPage = lazy(() => import('@/features/games/area-scaler/AreaScalerPage').then((m) => ({ default: m.AreaScalerPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const DataPage = lazy(() => import('@/pages/DataPage').then((m) => ({ default: m.DataPage })));

const withSuspense = (C: React.ComponentType) => () => (
  <Suspense fallback={<Skeleton className="h-96" />}>
    <C />
  </Suspense>
);

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: NotFoundPage });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/play/area-scaler', component: withSuspense(AreaScalerPage) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: withSuspense(SettingsPage) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/data', component: withSuspense(DataPage) }),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export type GameId =
  | 'area-scaler'
  | 'capitals'
  | 'flags'
  | 'map-click'
  | 'shapes'
  | 'higher-lower'
  | 'borders'
  | 'features'
  | 'daily';

import type { IconName } from '@/components/icons';

export interface GameMeta {
  id: GameId;
  ready: boolean;
  icon: IconName;
}

/** Order = order on the home page. `ready` flips as each module ships. */
export const gamePath = (id: GameId) => `/play/${id}` as const;

export const GAMES: GameMeta[] = [
  { id: 'area-scaler', ready: true, icon: 'area' },
  { id: 'capitals', ready: true, icon: 'capital' },
  { id: 'flags', ready: true, icon: 'flag' },
  { id: 'map-click', ready: true, icon: 'pin' },
  { id: 'shapes', ready: true, icon: 'shape' },
  { id: 'higher-lower', ready: true, icon: 'updown' },
  { id: 'borders', ready: true, icon: 'chain' },
  { id: 'features', ready: true, icon: 'mountain' },
  { id: 'daily', ready: true, icon: 'calendar' },
];

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
export const GAMES: GameMeta[] = [
  { id: 'area-scaler', ready: true, icon: 'area' },
  { id: 'capitals', ready: false, icon: 'capital' },
  { id: 'flags', ready: false, icon: 'flag' },
  { id: 'map-click', ready: false, icon: 'pin' },
  { id: 'shapes', ready: false, icon: 'shape' },
  { id: 'higher-lower', ready: false, icon: 'updown' },
  { id: 'borders', ready: false, icon: 'chain' },
  { id: 'features', ready: false, icon: 'mountain' },
  { id: 'daily', ready: false, icon: 'calendar' },
];

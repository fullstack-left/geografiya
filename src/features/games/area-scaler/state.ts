/**
 * Area Scaler game state machine (pure reducer, UI-agnostic).
 *
 *   setup → playing ⇄ revealed → … → summary
 */
import type { Pair } from './pairs';
import { accuracy, clampRatio, roundPoints, type Difficulty, type RoundResult } from './scoring';

export const ROUNDS_PER_GAME = 5;

export type Phase = 'setup' | 'playing' | 'revealed' | 'summary';

export interface GameState {
  phase: Phase;
  difficulty: Difficulty;
  pairs: Pair[];
  round: number;
  /** Current guess: on-screen area of target / reference. */
  userRatio: number;
  results: RoundResult[];
}

export type Action =
  | { type: 'start'; difficulty: Difficulty; pairs: Pair[] }
  | { type: 'setRatio'; ratio: number }
  | { type: 'scaleBy'; factor: number }
  | { type: 'confirm'; trueRatio: number }
  | { type: 'next' }
  | { type: 'reset' };

export const initialState: GameState = {
  phase: 'setup',
  difficulty: 'easy',
  pairs: [],
  round: 0,
  userRatio: 1,
  results: [],
};

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'start':
      if (action.pairs.length === 0) return state;
      return { ...initialState, phase: 'playing', difficulty: action.difficulty, pairs: action.pairs };
    case 'setRatio':
      return state.phase === 'playing' ? { ...state, userRatio: clampRatio(action.ratio) } : state;
    case 'scaleBy':
      return state.phase === 'playing' ? { ...state, userRatio: clampRatio(state.userRatio * action.factor) } : state;
    case 'confirm': {
      if (state.phase !== 'playing') return state;
      const pair = state.pairs[state.round];
      if (!pair) return state;
      const acc = accuracy(state.userRatio, action.trueRatio);
      const result: RoundResult = {
        ...pair,
        userRatio: state.userRatio,
        trueRatio: action.trueRatio,
        accuracy: acc,
        points: roundPoints(acc, state.difficulty),
      };
      return { ...state, phase: 'revealed', results: [...state.results, result] };
    }
    case 'next': {
      if (state.phase !== 'revealed') return state;
      const round = state.round + 1;
      if (round >= state.pairs.length) return { ...state, phase: 'summary' };
      return { ...state, phase: 'playing', round, userRatio: 1 };
    }
    case 'reset':
      return { ...initialState, difficulty: state.difficulty };
  }
}

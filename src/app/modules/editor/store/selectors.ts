import _ from 'lodash';
import {
  createSelectorCreator,
  createStructuredSelector as createStructuredSelectorWithCreator,
  lruMemoize,
  type SelectorsObject,
} from 'reselect';

import type { State } from './reducer';

// Only the most recent arguments are memoized (reselect's default before v5). reselect 5's
// weakMapMemoize caches every distinct set of arguments, which would retain a rendered vector
// layer for every frame of the animation that gets played.
export const createSelector = createSelectorCreator({
  memoize: lruMemoize,
  argsMemoize: lruMemoize,
});

export const createDeepEqualSelector = createSelectorCreator({
  memoize: lruMemoize,
  memoizeOptions: { equalityCheck: (a: unknown, b: unknown) => _.isEqual(a, b) },
  argsMemoize: lruMemoize,
});

export function createStructuredSelector<T extends SelectorsObject>(selectors: T) {
  return createStructuredSelectorWithCreator(selectors, createSelector);
}

const getState = (state: State) => state;
export const getEditorState = createSelector(getState, s => s.present);

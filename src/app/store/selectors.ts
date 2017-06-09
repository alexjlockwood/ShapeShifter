import {
  AppState,
  State,
} from './reducer';
import * as _ from 'lodash';
import {
  createSelector,
  createSelectorCreator,
  defaultMemoize,
} from 'reselect';

const getState = (state: State) => state;
export const getAppState = createSelector(getState, s => s.present);
export const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual);

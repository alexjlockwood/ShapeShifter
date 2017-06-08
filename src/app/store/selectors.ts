import { AppState, State } from './reducer';
import * as _ from 'lodash';
import { createSelector, createSelectorCreator, defaultMemoize } from 'reselect';

export const getState = (state: State) => state;
export const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual);

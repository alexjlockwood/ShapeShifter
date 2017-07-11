import * as _ from 'lodash-es';
import { createSelector, createSelectorCreator, defaultMemoize } from 'reselect';

import { State } from './reducer';

const getState = (state: State) => state;
export const getAppState = createSelector(getState, s => s.present);
export const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual);

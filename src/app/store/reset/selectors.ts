import { createSelector } from 'reselect';

import { getAppState } from '../selectors';

const getResetState = createSelector(getAppState, s => s.reset);
export const isBeingReset = createSelector(getResetState, r => r.isBeingReset);

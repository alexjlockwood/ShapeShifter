import { getAppState } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getResetState = createSelector(getAppState, s => s.reset);
export const isBeingReset = createSelector(getResetState, r => r.isBeingReset);

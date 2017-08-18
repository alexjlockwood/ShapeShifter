import { getAppState } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getToolModeState = createSelector(getAppState, s => s.toolmode);
export const getToolMode = createSelector(getToolModeState, t => t.toolMode);

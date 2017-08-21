import { getAppState } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getToolModeState = createSelector(getAppState, s => s.toolmode);
export const getToolMode = createSelector(getToolModeState, t => t.toolMode);
export const getFillColor = createSelector(getToolModeState, t => t.fillColor);
export const getStrokeColor = createSelector(getToolModeState, t => t.strokeColor);

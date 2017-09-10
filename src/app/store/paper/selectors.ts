import { getAppState } from 'app/store/selectors';
import { createDeepEqualSelector } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getToolMode = createSelector(getPaperState, t => t.toolMode);
export const getFillColor = createSelector(getPaperState, t => t.fillColor);
export const getStrokeColor = createSelector(getPaperState, t => t.strokeColor);
export const getSelectionBox = createDeepEqualSelector(getPaperState, t => t.selectionBox);
export const getPathPreview = createDeepEqualSelector(getPaperState, t => t.pathPreview);

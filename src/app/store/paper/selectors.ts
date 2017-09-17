import { getAppState } from 'app/store/selectors';
import { createDeepEqualSelector } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getToolMode = createSelector(getPaperState, t => t.toolMode);
export const getSelectionBox = createDeepEqualSelector(getPaperState, t => t.selectionBox);
export const getPathOverlayInfo = createSelector(getPaperState, t => t.pathOverlayInfo);
export const getFocusedPathInfo = createDeepEqualSelector(getPaperState, t => t.focusedPathInfo);
export const getCanvasCursor = createSelector(getPaperState, t => t.canvasCursor);

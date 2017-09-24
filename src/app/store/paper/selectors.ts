import { getAppState } from 'app/store/selectors';
import { createDeepEqualSelector } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getToolMode = createSelector(getPaperState, p => p.toolMode);
export const getSelectionBox = createDeepEqualSelector(getPaperState, p => p.selectionBox);
export const getPathOverlayInfo = createSelector(getPaperState, p => p.pathOverlayInfo);
export const getFocusedPathInfo = createDeepEqualSelector(getPaperState, p => p.focusedPathInfo);
export const getCanvasCursor = createSelector(getPaperState, p => p.canvasCursor);
export const getSnapGuideInfo = createSelector(getPaperState, p => p.snapGuideInfo);
export const getZoomPanInfo = createSelector(getPaperState, p => p.zoomPanInfo);
export const getTooltipInfo = createSelector(getPaperState, p => p.tooltipInfo);

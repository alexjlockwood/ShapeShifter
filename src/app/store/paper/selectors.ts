import { getAppState } from 'app/store/selectors';
import { createDeepEqualSelector } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getToolMode = createDeepEqualSelector(getPaperState, p => p.toolMode);
export const getSelectionBox = createDeepEqualSelector(getPaperState, p => p.selectionBox);
export const getCreatePathInfo = createDeepEqualSelector(getPaperState, p => p.createPathInfo);
export const getSplitCurveInfo = createDeepEqualSelector(getPaperState, p => p.splitCurveInfo);
export const getFocusedPathInfo = createDeepEqualSelector(getPaperState, p => p.focusedPathInfo);
export const getCanvasCursor = createDeepEqualSelector(getPaperState, p => p.canvasCursor);
export const getSnapGuideInfo = createDeepEqualSelector(getPaperState, p => p.snapGuideInfo);
export const getZoomPanInfo = createDeepEqualSelector(getPaperState, p => p.zoomPanInfo);
export const getTooltipInfo = createDeepEqualSelector(getPaperState, p => p.tooltipInfo);

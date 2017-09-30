import { getAppState } from 'app/store/selectors';
import { createDeepEqualSelector } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getZoomPanInfo = createDeepEqualSelector(getPaperState, p => p.zoomPanInfo);
const getToolModeInfo = createSelector(getPaperState, p => p.toolModeInfo);
export const getToolMode = createDeepEqualSelector(getToolModeInfo, p => p.toolMode);
export const getSelectionBox = createDeepEqualSelector(getToolModeInfo, p => p.selectionBox);
export const getCreatePathInfo = createDeepEqualSelector(getToolModeInfo, p => p.createPathInfo);
export const getSplitCurveInfo = createDeepEqualSelector(getToolModeInfo, p => p.splitCurveInfo);
export const getFocusedPathInfo = createDeepEqualSelector(getToolModeInfo, p => p.focusedPathInfo);
export const getSnapGuideInfo = createDeepEqualSelector(getToolModeInfo, p => p.snapGuideInfo);
export const getTooltipInfo = createDeepEqualSelector(getToolModeInfo, p => p.tooltipInfo);
export const getCanvasCursor = createDeepEqualSelector(getToolModeInfo, p => p.canvasCursor);

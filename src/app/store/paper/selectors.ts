import { ToolMode } from 'app/model/paper';
import { getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { createDeepEqualSelector, getAppState } from 'app/store/selectors';
import { createSelector, createStructuredSelector } from 'reselect';

const getPaperState = createSelector(getAppState, s => s.paper);
export const getZoomPanInfo = createDeepEqualSelector(getPaperState, p => p.zoomPanInfo);
const getToolModeInfo = createSelector(getPaperState, p => p.toolModeInfo);
export const getToolMode = createDeepEqualSelector(getToolModeInfo, p => p.toolMode);
export const getSelectionBox = createDeepEqualSelector(getToolModeInfo, p => p.selectionBox);
export const getCreatePathInfo = createDeepEqualSelector(getToolModeInfo, p => p.createPathInfo);
export const getSplitCurveInfo = createDeepEqualSelector(getToolModeInfo, p => p.splitCurveInfo);
export const getFocusedPathInfo = createDeepEqualSelector(getToolModeInfo, p => p.focusedPathInfo);
export const getRotateItemsInfo = createDeepEqualSelector(getToolModeInfo, p => p.rotateItemsInfo);
export const getTransformPathInfo = createDeepEqualSelector(
  getToolModeInfo,
  p => p.transformPathInfo,
);
export const getSnapGuideInfo = createDeepEqualSelector(getToolModeInfo, p => p.snapGuideInfo);
export const getTooltipInfo = createDeepEqualSelector(getToolModeInfo, p => p.tooltipInfo);
export const getCanvasCursor = createDeepEqualSelector(getToolModeInfo, p => p.canvasCursor);

const getSingleSelectedChildlessLayer = createSelector(
  [getVectorLayer, getSelectedLayerIds],
  (vl, layerIds) => {
    if (layerIds.size !== 1) {
      return undefined;
    }
    const layerId = layerIds.values().next().value;
    const layer = vl.findLayerById(layerId);
    // TODO: consolidate this logic in a single place (the layer.children.length check is used in gestures too)
    return layer.children.length ? undefined : layer;
  },
);

const isFocusPathChecked = createSelector(getFocusedPathInfo, fpi => !!fpi);
// TODO: exclude empty groups for rotate items?
const isRotateItemsEnabled = createSelector(getSelectedLayerIds, layerIds => layerIds.size > 0);
const isRotateItemsChecked = createSelector(getRotateItemsInfo, rii => !!rii);
const isTransformPathEnabled = createSelector(getSingleSelectedChildlessLayer, layer => !!layer);
const isTransformPathChecked = createSelector(getTransformPathInfo, tpi => !!tpi);
const isSelectionChecked = createSelector(
  [getToolMode, isFocusPathChecked, isRotateItemsChecked, isTransformPathChecked],
  (toolMode, focusPathChecked, rotateItemsChecked, transformPathChecked) => {
    return (
      toolMode === ToolMode.Selection &&
      !focusPathChecked &&
      !rotateItemsChecked &&
      !transformPathChecked
    );
  },
);

export const getToolPanelState = createStructuredSelector({
  toolMode: getToolMode,
  isSelectionChecked,
  isFocusPathChecked,
  isRotateItemsEnabled,
  isRotateItemsChecked,
  isTransformPathEnabled,
  isTransformPathChecked,
});

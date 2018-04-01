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
export const getEditPathInfo = createDeepEqualSelector(getToolModeInfo, p => p.editPathInfo);
export const getRotateItemsInfo = createDeepEqualSelector(getToolModeInfo, p => p.rotateItemsInfo);
export const getTransformPathsInfo = createDeepEqualSelector(
  getToolModeInfo,
  p => p.transformPathsInfo,
);
export const getSnapGuideInfo = createDeepEqualSelector(getToolModeInfo, p => p.snapGuideInfo);
export const getTooltipInfo = createDeepEqualSelector(getToolModeInfo, p => p.tooltipInfo);
export const getCursorType = createDeepEqualSelector(getPaperState, p => p.cursorType);

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

const isEditPathChecked = createSelector(getEditPathInfo, epi => !!epi);
// TODO: exclude empty groups for rotate items?
const isRotateItemsEnabled = createSelector(getSelectedLayerIds, layerIds => layerIds.size > 0);
const isRotateItemsChecked = createSelector(getRotateItemsInfo, rii => !!rii);
const isTransformPathsEnabled = createSelector(getSingleSelectedChildlessLayer, layer => !!layer);
const isTransformPathsChecked = createSelector(getTransformPathsInfo, tpi => !!tpi);
const isSelectionChecked = createSelector(
  [getToolMode, isEditPathChecked, isRotateItemsChecked, isTransformPathsChecked],
  (toolMode, editPathChecked, rotateItemsChecked, transformPathChecked) => {
    return (
      toolMode === ToolMode.Selection &&
      !editPathChecked &&
      !rotateItemsChecked &&
      !transformPathChecked
    );
  },
);

export const getToolPanelState = createStructuredSelector({
  toolMode: getToolMode,
  isSelectionChecked,
  isEditPathChecked,
  isRotateItemsEnabled,
  isRotateItemsChecked,
  isTransformPathsEnabled,
  isTransformPathsChecked,
});

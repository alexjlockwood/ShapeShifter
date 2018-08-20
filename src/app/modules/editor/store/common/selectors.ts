import { getActionMode, isActionMode } from 'app/modules/editor/store/actionmode/selectors';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import { getHoveredLayerId } from 'app/modules/editor/store/paper/selectors';
import { isBeingReset } from 'app/modules/editor/store/reset/selectors';
import {
  getAnimation,
  getSelectedBlockIds,
  getSelectedBlockLayerIds,
  getSingleSelectedPathBlock,
  isAnimationSelected,
} from 'app/modules/editor/store/timeline/selectors';
import { createSelector, createStructuredSelector } from 'reselect';

export const getCanvasOverlayState = createStructuredSelector({
  hiddenLayerIds: getHiddenLayerIds,
  selectedLayerIds: getSelectedLayerIds,
  selectedBlockLayerIds: getSelectedBlockLayerIds,
  isActionMode,
});

export const getPropertyInputState = createStructuredSelector({
  animation: getAnimation,
  isAnimationSelected,
  selectedBlockIds: getSelectedBlockIds,
  vectorLayer: getVectorLayer,
  selectedLayerIds: getSelectedLayerIds,
});

export const getLayerListTreeState = createStructuredSelector({
  animation: getAnimation,
  selectedLayerIds: getSelectedLayerIds,
  collapsedLayerIds: getCollapsedLayerIds,
  hiddenLayerIds: getHiddenLayerIds,
  hoveredLayerId: getHoveredLayerId,
  isActionMode,
});

export const getTimelineAnimationRowState = createStructuredSelector({
  animation: getAnimation,
  collapsedLayerIds: getCollapsedLayerIds,
  selectedBlockIds: getSelectedBlockIds,
  isActionMode,
});

export const getLayerTimelineState = createStructuredSelector({
  animation: getAnimation,
  vectorLayer: getVectorLayer,
  isAnimationSelected,
  selectedBlockIds: getSelectedBlockIds,
  isBeingReset,
  isActionMode,
  actionMode: getActionMode,
  singleSelectedPathBlock: getSingleSelectedPathBlock,
});

export const isWorkspaceDirty = createSelector(
  [getVectorLayer, getAnimation],
  (vl, anim) => vl.children.length > 0 || anim.blocks.length > 0,
);

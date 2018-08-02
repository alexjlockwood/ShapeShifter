import { getActionMode, isActionMode } from 'app/editor/store/actionmode/selectors';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/editor/store/layers/selectors';
import { getHoveredLayerId } from 'app/editor/store/paper/selectors';
import { isBeingReset } from 'app/editor/store/reset/selectors';
import {
  getAnimation,
  getSelectedBlockIds,
  getSelectedBlockLayerIds,
  getSingleSelectedPathBlock,
  isAnimationSelected,
} from 'app/editor/store/timeline/selectors';
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

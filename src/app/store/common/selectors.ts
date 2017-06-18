import {
  getActionMode,
  isActionMode,
} from '../actionmode/selectors';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import { isBeingReset } from '../reset/selectors';
import {
  getAnimation,
  getSelectedBlockIds,
  getSelectedBlockLayerIds,
  getSingleSelectedPathBlock,
  isAnimationSelected,
} from '../timeline/selectors';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

export const getCanvasOverlayState =
  createStructuredSelector({
    hiddenLayerIds: getHiddenLayerIds,
    selectedLayerIds: getSelectedLayerIds,
    selectedBlockLayerIds: getSelectedBlockLayerIds,
    isActionMode,
  });

export const getPropertyInputState =
  createStructuredSelector({
    animation: getAnimation,
    isAnimationSelected,
    selectedBlockIds: getSelectedBlockIds,
    vectorLayer: getVectorLayer,
    selectedLayerIds: getSelectedLayerIds,
  });

export const getLayerListTreeState =
  createStructuredSelector({
    animation: getAnimation,
    selectedLayerIds: getSelectedLayerIds,
    collapsedLayerIds: getCollapsedLayerIds,
    hiddenLayerIds: getHiddenLayerIds,
    isActionMode,
  });

export const getTimelineAnimationRowState =
  createStructuredSelector({
    animation: getAnimation,
    collapsedLayerIds: getCollapsedLayerIds,
    selectedBlockIds: getSelectedBlockIds,
    isActionMode,
  });

export const getLayerTimelineState =
  createStructuredSelector({
    animation: getAnimation,
    vectorLayer: getVectorLayer,
    isAnimationSelected,
    selectedBlockIds: getSelectedBlockIds,
    isBeingReset,
    isActionMode,
    actionMode: getActionMode,
    singleSelectedPathBlock: getSingleSelectedPathBlock,
  });

export const getAnimatorState =
  createStructuredSelector({
    animation: getAnimation,
    vectorLayer: getVectorLayer,
  });

export const isWorkspaceDirty =
  createSelector(
    [getVectorLayer, getAnimation],
    (vectorLayer, animation) => {
      return vectorLayer.children.length > 0 || animation.blocks.length > 0;
    },
  );

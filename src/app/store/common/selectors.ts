import { isActionMode } from '../actionmode/selectors';
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
    isActionMode,
    selectedBlockLayerIds: getSelectedBlockLayerIds,
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
  });

export const getTimelineAnimationRowState =
  createStructuredSelector({
    animation: getAnimation,
    collapsedLayerIds: getCollapsedLayerIds,
    selectedBlockIds: getSelectedBlockIds,
  });

export const getLayerTimelineState =
  createStructuredSelector({
    animation: getAnimation,
    vectorLayer: getVectorLayer,
    isAnimationSelected,
    selectedBlockIds: getSelectedBlockIds,
    isBeingReset,
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

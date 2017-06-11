import { isActionMode } from '../actionmode/selectors';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import {
  getActiveAnimation,
  getActiveAnimationId,
  getAnimations,
  getSelectedAnimationIds,
  getSelectedBlockIds,
  getSelectedBlockLayerIds,
} from '../timeline/selectors';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

export const getCanvasLayersState =
  createStructuredSelector({
    vectorLayer: getVectorLayer,
    hiddenLayerIds: getHiddenLayerIds,
  });

export const getCanvasOverlayState =
  createStructuredSelector({
    vectorLayer: getVectorLayer,
    hiddenLayerIds: getHiddenLayerIds,
    selectedLayerIds: getSelectedLayerIds,
    isActionMode,
    selectedBlockLayerIds: getSelectedBlockLayerIds,
  });

export const getPropertyInputState =
  createStructuredSelector({
    animations: getAnimations,
    selectedAnimationIds: getSelectedAnimationIds,
    selectedBlockIds: getSelectedBlockIds,
    vectorLayer: getVectorLayer,
    selectedLayerIds: getSelectedLayerIds,
  });

export const getLayerListTreeState =
  createStructuredSelector({
    animations: getAnimations,
    selectedLayerIds: getSelectedLayerIds,
    collapsedLayerIds: getCollapsedLayerIds,
    hiddenLayerIds: getHiddenLayerIds,
  });

export const getTimelineAnimationRowState =
  createStructuredSelector({
    animations: getAnimations,
    collapsedLayerIds: getCollapsedLayerIds,
    selectedBlockIds: getSelectedBlockIds,
  });

export const getLayerTimelineState =
  createStructuredSelector({
    animations: getAnimations,
    vectorLayer: getVectorLayer,
    selectedAnimationIds: getSelectedAnimationIds,
    activeAnimationId: getActiveAnimationId,
    selectedBlockIds: getSelectedBlockIds,
  });

export const getAnimatorState =
  createStructuredSelector({
    activeAnimation: getActiveAnimation,
    vectorLayer: getVectorLayer,
  });

export const isWorkspaceDirty =
  createSelector(
    [getVectorLayer, getAnimations],
    (vectorLayer, animations) => {
      return vectorLayer.children.length > 0
        || animations.length > 1
        || animations[0].blocks.length > 0;
    },
  );

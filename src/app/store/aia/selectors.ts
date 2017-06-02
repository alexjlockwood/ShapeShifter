import {
  getActiveVectorLayer,
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayers,
} from '../layers/selectors';
import {
  getActiveAnimation,
  getActiveAnimationId,
  getAnimations,
  getSelectedAnimationIds,
  getSelectedBlockIds,
} from '../timeline/selectors';
import { createStructuredSelector } from 'reselect';

export const getPropertyInputState =
  createStructuredSelector({
    animations: getAnimations,
    selectedAnimationIds: getSelectedAnimationIds,
    selectedBlockIds: getSelectedBlockIds,
    vectorLayers: getVectorLayers,
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
    vectorLayers: getVectorLayers,
    selectedAnimationIds: getSelectedAnimationIds,
    activeAnimationId: getActiveAnimationId,
    selectedBlockIds: getSelectedBlockIds,
  });

export const getAnimatorState =
  createStructuredSelector({
    activeAnimation: getActiveAnimation,
    activeVectorLayer: getActiveVectorLayer,
  });

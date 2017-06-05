import { isActionMode } from '../actionmode/selectors';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from '../layers/selectors';
import { State } from '../reducer';
import {
  getActiveAnimation,
  getActiveAnimationId,
  getAnimations,
  getSelectedAnimationIds,
  getSelectedBlockIds,
  getSelectedBlockLayerIds,
} from '../timeline/selectors';
import * as _ from 'lodash';
import { createSelectorCreator, defaultMemoize } from 'reselect';
import { createStructuredSelector } from 'reselect';

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

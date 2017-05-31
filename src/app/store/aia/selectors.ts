import { State } from '..';
import { PathAnimationBlock } from '../../scripts/animations';
import { createDeepEqualSelector, getState } from '../selectors';
import * as _ from 'lodash';
import { createSelector, createStructuredSelector } from 'reselect';

// Timeline state selectors.
const getTimelineState = createSelector(getState, s => s.timeline)
export const getAnimations = createSelector(getTimelineState, t => t.animations);
const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
const getActiveAnimationId = createSelector(getTimelineState, t => t.activeAnimationId);
const getActiveAnimation = createSelector(
  getAnimations,
  getActiveAnimationId,
  (animations, id) => _.find(animations, a => a.id === id),
);
export const getSelectedBlockIds = createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);

// Layer state selectors.
const getLayerState = createSelector(getState, s => s.layers);
export const getVectorLayers = createSelector(getLayerState, l => l.vectorLayers);
const getActiveVectorLayerId = createSelector(getLayerState, l => l.activeVectorLayerId);
export const getActiveVectorLayer = createSelector(
  getVectorLayers,
  getActiveVectorLayerId,
  (vls, id) => _.find(vls, vl => vl.id === id),
);
export const getSelectedLayerIds =
  createDeepEqualSelector(getLayerState, l => l.selectedLayerIds);
export const getCollapsedLayerIds =
  createDeepEqualSelector(getLayerState, l => l.collapsedLayerIds);
export const getHiddenLayerIds =
  createDeepEqualSelector(getLayerState, l => l.hiddenLayerIds);

// Exported property input selector.
export const getPropertyInputState = createStructuredSelector({
  animations: getAnimations,
  selectedAnimationIds: getSelectedAnimationIds,
  selectedBlockIds: getSelectedBlockIds,
  vectorLayers: getVectorLayers,
  selectedLayerIds: getSelectedLayerIds,
});

// Exported layer list tree selectors.
export const getLayerListTreeState = createStructuredSelector({
  animations: getAnimations,
  selectedLayerIds: getSelectedLayerIds,
  collapsedLayerIds: getCollapsedLayerIds,
  hiddenLayerIds: getHiddenLayerIds,
});

// Exported timeline animation row selectors.
export const getTimelineAnimationRowState = createStructuredSelector({
  animations: getAnimations,
  collapsedLayerIds: getCollapsedLayerIds,
  selectedBlockIds: getSelectedBlockIds,
});

// Exported layer timeline selectors.
export const getLayerTimelineState = createStructuredSelector({
  animations: getAnimations,
  vectorLayers: getVectorLayers,
  selectedAnimationIds: getSelectedAnimationIds,
  activeAnimationId: getActiveAnimationId,
  selectedBlockIds: getSelectedBlockIds,
});

// Exported animator selectors.
export const getAnimatorState = createStructuredSelector({
  activeAnimation: getActiveAnimation,
  activeVectorLayer: getActiveVectorLayer,
});

import { State } from '..';
import { PathAnimationBlock } from '../../scripts/animations';
import { createDeepEqualSelector } from '../selectors';
import * as _ from 'lodash';
import {
  createSelector,
  createStructuredSelector,
} from 'reselect';

const getState = (state: State) => state.aia;

// Timeline state selectors.
const getTimelineState = createSelector(getState, s => s.timeline)
export const getAnimations = createSelector(getTimelineState, t => t.animations);
const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
const getActiveAnimationId = createDeepEqualSelector(getTimelineState, t => t.activeAnimationId);
const getActiveAnimation = createSelector(
  getAnimations,
  getActiveAnimationId,
  (anims, id) => _.find(anims, anim => anim.id === id),
);
const getSelectedBlockIds = createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);
const getSelectedBlocks = createSelector(
  getActiveAnimation,
  getSelectedBlockIds,
  (animation, blockIds) => {
    return Array.from(blockIds)
      .map(blockId => _.find(animation.blocks, b => b.id === blockId));
  },
);

// Layer state selectors.
const getLayerState = createSelector(getState, s => s.layers);
const getVectorLayers = createSelector(getLayerState, l => l.vectorLayers);
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

// File importer selectors.
export const getImportedVectorLayers = getVectorLayers;

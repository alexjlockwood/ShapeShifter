import { PathAnimationBlock } from 'app/model/timeline';
import { createDeepEqualSelector, getAppState } from 'app/store/selectors';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getTimelineState = createSelector(getAppState, s => s.timeline);
export const getAnimation = createSelector(getTimelineState, t => t.animation);
export const isAnimationSelected = createSelector(getTimelineState, t => t.isAnimationSelected);
export const getSelectedBlockIds = createDeepEqualSelector(
  getTimelineState,
  t => t.selectedBlockIds,
);
export const getSingleSelectedBlockId = createSelector(
  getSelectedBlockIds,
  blockIds => (blockIds.size === 1 ? blockIds.values().next().value : undefined),
);
export const getSingleSelectedPathBlock = createSelector(
  [getAnimation, getSingleSelectedBlockId],
  (anim, blockId) => {
    if (!blockId) {
      return undefined;
    }
    return _.find(
      anim.blocks,
      b => b.id === blockId && b instanceof PathAnimationBlock,
    ) as PathAnimationBlock;
  },
);
export const getSelectedBlockLayerIds = createDeepEqualSelector(
  [getAnimation, getSelectedBlockIds],
  (anim, blockIds) => {
    return new Set(Array.from(blockIds).map(id => _.find(anim.blocks, b => b.id === id).layerId));
  },
);
export const getSingleSelectedBlockLayerId = createSelector(
  getSelectedBlockLayerIds,
  blockLayerIds => (blockLayerIds.size === 1 ? blockLayerIds.values().next().value : undefined),
);

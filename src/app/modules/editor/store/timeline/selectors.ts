import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import {
  createDeepEqualSelector,
  createSelector,
  getEditorState,
} from 'app/modules/editor/store/selectors';
import _ from 'lodash';

const getTimelineState = createSelector(getEditorState, s => s.timeline);
export const getAnimation = createSelector(getTimelineState, t => t.animation);
export const isAnimationSelected = createSelector(getTimelineState, t => t.isAnimationSelected);
export const getSelectedBlockIds = createDeepEqualSelector(
  getTimelineState,
  t => t.selectedBlockIds,
);
export const getSingleSelectedBlockId = createSelector(getSelectedBlockIds, blockIds =>
  blockIds.size === 1 ? blockIds.values().next().value : undefined,
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
    return new Set(anim.blocks.filter(b => blockIds.has(b.id)).map(b => b.layerId));
  },
);
export const getSingleSelectedBlockLayerId = createSelector(
  getSelectedBlockLayerIds,
  blockLayerIds => (blockLayerIds.size === 1 ? blockLayerIds.values().next().value : undefined),
);

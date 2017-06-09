import {
  createDeepEqualSelector,
  getAppState,
} from '../selectors';
import { AnimationBlock } from 'app/scripts/model/timeline';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getTimelineState = createSelector(getAppState, s => s.timeline);

export const getAnimations = createSelector(getTimelineState, t => t.animations);
export const getActiveAnimationId = createSelector(getTimelineState, t => t.activeAnimationId);
export const getActiveAnimation =
  createSelector(
    [getAnimations, getActiveAnimationId],
    (anims, id) => _.find(anims, a => a.id === id),
  );
export const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
export const getSelectedBlockIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);
export const getSelectedBlockLayerIds =
  createSelector(
    [getSelectedBlockIds, getAnimations],
    (blockIds, anims) => {
      const blocks = _.flatMap(anims, a => a.blocks as AnimationBlock[]);
      return new Set(Array.from(blockIds).map(id => _.find(blocks, b => b.id === id).layerId));
    });

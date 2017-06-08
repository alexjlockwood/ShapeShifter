import { AnimationBlock } from '../../scripts/timeline';
import { createDeepEqualSelector, getState } from '../selectors';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getTimelineState = createSelector(getState, s => s.present.timeline);

export const getAnimations =
  createSelector(getTimelineState, t => t.animations);
export const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
export const getActiveAnimationId =
  createSelector(getTimelineState, t => t.activeAnimationId);
export const getSelectedBlockIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);
export const getSelectedBlockLayerIds =
  createSelector(
    getSelectedBlockIds,
    getAnimations,
    (blockIds, animations) => {
      const blocks = _.flatMap(animations, a => a.blocks as AnimationBlock[]);
      return new Set(Array.from(blockIds).map(id => _.find(blocks, b => b.id === id).layerId));
    });

export const getActiveAnimation =
  createSelector(
    getAnimations,
    getActiveAnimationId,
    (animations, id) => _.find(animations, a => a.id === id),
  );

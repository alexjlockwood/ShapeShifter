import {
  createDeepEqualSelector,
  getAppState,
} from '../selectors';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getTimelineState = createSelector(getAppState, s => s.timeline);

export const getAnimation = createSelector(getTimelineState, t => t.animation);
export const isAnimationSelected = createSelector(getTimelineState, t => t.isAnimationSelected);
export const getSelectedBlockIds = createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);
export const getSelectedBlockLayerIds =
  createSelector(
    [getAnimation, getSelectedBlockIds],
    (anim, blockIds) => {
      return new Set(Array.from(blockIds).map(id => _.find(anim.blocks, b => b.id === id).layerId));
    });

import { createDeepEqualSelector, getState } from '../selectors';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getTimelineState = createSelector(getState, s => s.timeline);

export const getAnimations =
  createSelector(getTimelineState, t => t.animations);
export const getSelectedAnimationIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedAnimationIds);
export const getActiveAnimationId =
  createSelector(getTimelineState, t => t.activeAnimationId);
export const getSelectedBlockIds =
  createDeepEqualSelector(getTimelineState, t => t.selectedBlockIds);

export const getActiveAnimation =
  createSelector(
    getAnimations,
    getActiveAnimationId,
    (animations, id) => _.find(animations, a => a.id === id),
  );

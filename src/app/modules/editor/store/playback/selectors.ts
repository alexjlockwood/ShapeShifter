import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getEditorState } from 'app/modules/editor/store/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { createSelector } from 'reselect';

export const getPlaybackState = createSelector(getEditorState, s => s.playback);
export const getIsSlowMotion = createSelector(getPlaybackState, p => p.isSlowMotion);
export const getIsPlaying = createSelector(getPlaybackState, p => p.isPlaying);
export const getIsRepeating = createSelector(getPlaybackState, p => p.isRepeating);
export const getCurrentTime = createSelector(getPlaybackState, p => p.currentTime);

const getAnimationRenderer = createSelector(
  [getVectorLayer, getAnimation],
  (vl, anim) => new AnimationRenderer(vl, anim),
);

export const getAnimatedVectorLayer = createSelector(
  [getAnimationRenderer, getCurrentTime],
  (animationRenderer, currentTime) => {
    const vl = animationRenderer.setCurrentTime(currentTime);
    return { vl, currentTime };
  },
);

import { getState } from '../selectors';
import { createSelector } from 'reselect';

export const getPlaybackState = createSelector(getState, s => s.present.playback);
export const getIsSlowMotion = createSelector(getPlaybackState, p => p.isSlowMotion);
export const getIsPlaying = createSelector(getPlaybackState, p => p.isPlaying);
export const getIsRepeating = createSelector(getPlaybackState, p => p.isRepeating);

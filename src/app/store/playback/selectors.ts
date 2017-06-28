import { createSelector } from 'reselect';

import { getAppState } from '../selectors';

export const getPlaybackState = createSelector(getAppState, s => s.playback);
export const getIsSlowMotion = createSelector(getPlaybackState, p => p.isSlowMotion);
export const getIsPlaying = createSelector(getPlaybackState, p => p.isPlaying);
export const getIsRepeating = createSelector(getPlaybackState, p => p.isRepeating);

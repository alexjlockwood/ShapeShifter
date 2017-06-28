import { createSelector } from 'reselect';

import { createDeepEqualSelector, getAppState } from '../selectors';

const getLayerState = createSelector(getAppState, s => s.layers);
export const getVectorLayer = createSelector(getLayerState, l => l.vectorLayer);
export const getSelectedLayerIds = createDeepEqualSelector(getLayerState, l => l.selectedLayerIds);
export const getCollapsedLayerIds = createDeepEqualSelector(
  getLayerState,
  l => l.collapsedLayerIds,
);
export const getHiddenLayerIds = createDeepEqualSelector(getLayerState, l => l.hiddenLayerIds);

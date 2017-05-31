import { createDeepEqualSelector, getState } from '../selectors';
import * as _ from 'lodash';
import { createSelector } from 'reselect';

const getLayerState = createSelector(getState, s => s.layers);

export const getVectorLayers =
  createSelector(getLayerState, l => l.vectorLayers);
export const getActiveVectorLayerId =
  createSelector(getLayerState, l => l.activeVectorLayerId);
export const getSelectedLayerIds =
  createDeepEqualSelector(getLayerState, l => l.selectedLayerIds);
export const getCollapsedLayerIds =
  createDeepEqualSelector(getLayerState, l => l.collapsedLayerIds);
export const getHiddenLayerIds =
  createDeepEqualSelector(getLayerState, l => l.hiddenLayerIds);

export const getActiveVectorLayer =
  createSelector(
    getVectorLayers,
    getActiveVectorLayerId,
    (vls, id) => _.find(vls, vl => vl.id === id),
  );

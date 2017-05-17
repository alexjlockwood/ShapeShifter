export { Store } from '@ngrx/store';
import * as _ from 'lodash';
import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { combineReducers } from '@ngrx/store';
import { environment } from '../../environments/environment';
import { compose } from '@ngrx/core/compose';
import * as fromRoot from './RootReducer';

export interface State {
  root: fromRoot.State,
}

const reducers = { root: fromRoot.reducer };
const developmentReducer: ActionReducer<State> =
  compose(storeFreeze, combineReducers)(reducers);
const productionReducer: ActionReducer<State> = combineReducers(reducers);

export function reducer(state: any, action: any) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}

// State selectors.
export const getTimelineState = (state: State) => state.root.state.timeline;
export const getAnimations = (state: State) => state.root.state.timeline.animations;
export const getSelectedAnimationIds = (state: State) => state.root.state.timeline.selectedAnimationIds;
export const getActiveAnimationId = (state: State) => state.root.state.timeline.activeAnimationId;
export const getActiveAnimation = createSelector(
  getActiveAnimationId,
  getAnimations,
  (activeAnimationId, animations) => {
    return _.find(animations, a => a.id === activeAnimationId);
  },
);
export const getSelectedBlockIds = (state: State) => state.root.state.timeline.selectedBlockIds;
export const getLayerState = (state: State) => state.root.state.layers;
export const getVectorLayers = (state: State) => state.root.state.layers.vectorLayers;
export const getSelectedLayerIds = (state: State) => state.root.state.layers.selectedLayerIds;
export const getCollapsedLayerIds = (state: State) => state.root.state.layers.collapsedLayerIds;
export const getHiddenLayerIds = (state: State) => state.root.state.layers.hiddenLayerIds;

// Playback selectors.
export const getPlaybackSettings = (state: State) => state.root.playback;
export const getIsSlowMotion = (state: State) => state.root.playback.isSlowMotion;
export const getIsPlaying = (state: State) => state.root.playback.isPlaying;
export const getIsRepeating = (state: State) => state.root.playback.isRepeating;

// Root actions.
export {
  NewWorkspace,
} from './RootActions';

// State actions.
export {
  AddAnimations,
  SelectAnimation,
  ActivateAnimation,
  ReplaceAnimations,
  AddBlock,
  SelectBlock,
  ReplaceBlocks,
  ReplaceLayer,
  SelectLayer,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  AddLayers,
  DeleteSelectedModels,
} from './StateActions';

// Playback actions.
export {
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from './PlaybackActions';

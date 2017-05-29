export { Store } from '@ngrx/store';
export {
  AppMode,
  Hover,
  HoverType,
  Selection,
  SelectionType,
} from './aia/reducer';

import { environment } from '../../environments/environment';
import * as fromAia from './aia/reducer';
import * as fromPlayback from './playback/reducer';
import * as fromShapeShifter from './shapeshifter/reducer';
import { compose } from '@ngrx/core/compose';
import {
  Action,
  ActionReducer,
  combineReducers,
} from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';

export interface State {
  aia: fromAia.State,
  playback: fromPlayback.State,
  shapeshifter: fromShapeShifter.State,
}

const reducers = {
  aia: fromAia.reducer,
  playback: fromPlayback.reducer,
  shapeshifter: fromShapeShifter.reducer,
};
const developmentReducer: ActionReducer<State> =
  compose(storeFreeze, combineReducers)(reducers);
const productionReducer: ActionReducer<State> = combineReducers(reducers);

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}

// Shared actions.
export { NewWorkspace } from './actions';

// Android Icon Animator actions.
export {
  AddAnimations,
  SelectAnimation,
  ActivateAnimation,
  ReplaceAnimations,
  AddBlock,
  SelectBlock,
  ReplaceBlocks,
  UpdatePathBlock,
  ReplaceLayer,
  SelectLayer,
  ClearLayerSelections,
  ToggleLayerExpansion,
  ToggleLayerVisibility,
  AddLayers,
  DeleteSelectedModels,
} from './aia/actions';

// Playback actions.
export {
  SetIsSlowMotion,
  SetIsPlaying,
  SetIsRepeating,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from './playback/actions';

// Shape Shifter actions.
export {
  EnterShapeShifterMode,
  ExitShapeShifterMode,
  SetAppMode,
  SetHover,
  SetSelections,
  ToggleSubPathSelection,
  ToggleSegmentSelections,
  TogglePointSelection,
} from './shapeshifter/actions';

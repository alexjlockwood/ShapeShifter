import { ActionReducer, ActionReducerMap, combineReducers, compose } from '@ngrx/store';

import * as fromActionMode from './actionmode/reducer';
import * as metaBatchAction from './batch/metareducer';
import * as fromLayers from './layers/reducer';
import * as fromPaper from './paper/reducer';
import * as fromPlayback from './playback/reducer';
import * as metaReset from './reset/metareducer';
import * as fromReset from './reset/reducer';
import * as fromTheme from './theme/reducer';
import * as fromTimeline from './timeline/reducer';
import * as metaUndoRedo from './undoredo/metareducer';

export type State = metaUndoRedo.StateWithHistoryAndTimestamp;

export interface EditorState {
  readonly layers: fromLayers.State;
  readonly timeline: fromTimeline.State;
  readonly playback: fromPlayback.State;
  readonly actionmode: fromActionMode.State;
  readonly reset: fromReset.State;
  readonly theme: fromTheme.State;
  readonly paper: fromPaper.State;
}

const reducers: ActionReducerMap<EditorState> = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  actionmode: fromActionMode.reducer,
  reset: fromReset.reducer,
  theme: fromTheme.reducer,
  paper: fromPaper.reducer,
};

const metaReducers = [
  // Meta-reducer that records past/present/future state.
  metaUndoRedo.metaReducer,
  // Meta-reducer that adds the ability to dispatch multiple actions at a time.
  metaBatchAction.metaReducer,
  // Meta-reducer that adds the ability to reset the entire state tree.
  metaReset.metaReducer,
];

export const reducer: ActionReducer<State> = compose(
  ...metaReducers,
  combineReducers,
)(reducers);

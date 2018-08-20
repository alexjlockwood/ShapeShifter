import { environment } from 'environments/environment';
import { storeLogger } from 'ngrx-store-logger';

import * as fromActionMode from './actionmode/reducer';
import * as metaBatchAction from './batch/metareducer';
import * as fromLayers from './layers/reducer';
import * as fromPaper from './paper/reducer';
import * as fromPlayback from './playback/reducer';
import * as metaReset from './reset/metareducer';
import * as fromReset from './reset/reducer';
import * as metaStoreFreeze from './storefreeze/metareducer';
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

export const reducers = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  actionmode: fromActionMode.reducer,
  reset: fromReset.reducer,
  theme: fromTheme.reducer,
  paper: fromPaper.reducer,
};

const prodMetaReducers = [
  // Meta-reducer that records past/present/future state.
  metaUndoRedo.metaReducer,
  // Meta-reducer that adds the ability to dispatch multiple actions at a time.
  metaBatchAction.metaReducer,
  // Meta-reducer that adds the ability to reset the entire state tree.
  metaReset.metaReducer,
];

const devMetaReducers = [
  // Meta reducer that logs the before/after state of the store
  // as actions are performed in dev builds.
  storeLogger({ collapsed: true }),
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  metaStoreFreeze.metaReducer,
];

export const metaReducers = environment.production
  ? prodMetaReducers
  : [...devMetaReducers, ...prodMetaReducers];

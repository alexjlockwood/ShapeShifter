import { Action, ActionReducer } from '@ngrx/store';
import undoable, { StateWithHistory, UndoableOptions, excludeAction } from 'redux-undo';

import * as actionModeActions from '../actionmode/actions';
import * as playbackActions from '../playback/actions';
import { AppState } from '../reducer';

const UNDO_HISTORY_SIZE = 30;
const UNDO_DEBOUNCE_MILLIS = 1000;
const UNDO_EXCLUDED_ACTIONS = [
  playbackActions.SET_IS_SLOW_MOTION,
  playbackActions.SET_IS_PLAYING,
  playbackActions.SET_IS_REPEATING,
  actionModeActions.START_ACTION_MODE,
  actionModeActions.SET_ACTION_MODE,
  actionModeActions.SET_ACTION_MODE_HOVER,
];

let groupCounter = 1;

export interface StateWithHistoryAndTimestamp extends StateWithHistory<AppState> {
  timestamp: number;
}

type StateReducer = ActionReducer<StateWithHistoryAndTimestamp>;
type AppStateReducer = ActionReducer<AppState>;

export function metaReducer(reducer: AppStateReducer): StateReducer {
  const undoableReducer = undoable(reducer, {
    limit: UNDO_HISTORY_SIZE,
    filter: excludeAction(UNDO_EXCLUDED_ACTIONS),
    groupBy: (action: Action, currState: AppState, prevState: StateWithHistoryAndTimestamp) => {
      if (Date.now() - prevState.timestamp < UNDO_DEBOUNCE_MILLIS) {
        return groupCounter;
      }
      groupCounter++;
      // tslint:disable-next-line: no-null-keyword
      return null;
    },
  } as UndoableOptions);
  return (state: StateWithHistoryAndTimestamp, action: Action) => {
    return { ...undoableReducer(state, action), timestamp: Date.now() };
  };
}

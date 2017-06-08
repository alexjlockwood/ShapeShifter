import { SELECT_LAYER } from '../layers/actions';
import { AppState } from '../reducer';
import { Action, ActionReducer } from '@ngrx/store';
import undoable from 'redux-undo';
import { StateWithHistory, excludeAction } from 'redux-undo';

const UNDO_HISTORY_SIZE = 30;
const UNDO_DEBOUNCE_MILLIS = 1000;
const UNDO_EXCLUDED_ACTIONS = []; // TODO: fill these in

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
      // tslint:disable-next-line
      return null;
    },
  });
  return (state: StateWithHistoryAndTimestamp, action: Action) => {
    const result = undoableReducer(state, action);
    return { ...result, timestamp: Date.now() };
  };
}

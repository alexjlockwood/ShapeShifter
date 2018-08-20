import { Action, ActionReducer } from 'app/modules/editor/store';
import { ActionModeActionTypes } from 'app/modules/editor/store/actionmode/actions';
import { PlaybackActionTypes } from 'app/modules/editor/store/playback/actions';
import { EditorState } from 'app/modules/editor/store/reducer';
import undoable, { StateWithHistory, UndoableOptions, excludeAction } from 'redux-undo';

const UNDO_HISTORY_SIZE = 30;
const UNDO_DEBOUNCE_MILLIS = 1000;
const UNDO_EXCLUDED_ACTIONS = [
  PlaybackActionTypes.SetIsSlowMotion,
  PlaybackActionTypes.SetIsPlaying,
  PlaybackActionTypes.SetIsRepeating,
  PlaybackActionTypes.SetCurrentTime,
  ActionModeActionTypes.SetActionMode,
  ActionModeActionTypes.SetActionModeHover,
];

let groupCounter = 1;

export interface StateWithHistoryAndTimestamp extends StateWithHistory<EditorState> {
  timestamp: number;
}

type StateReducer = ActionReducer<StateWithHistoryAndTimestamp>;
type EditorStateReducer = ActionReducer<EditorState>;

export function metaReducer(reducer: EditorStateReducer): StateReducer {
  const undoableReducer = undoable(reducer, {
    limit: UNDO_HISTORY_SIZE,
    filter: excludeAction(UNDO_EXCLUDED_ACTIONS),
    groupBy: (action: Action, currState: EditorState, prevState: StateWithHistoryAndTimestamp) => {
      if (Date.now() - prevState.timestamp < UNDO_DEBOUNCE_MILLIS) {
        return groupCounter;
      }
      groupCounter++;
      return undefined;
    },
  } as UndoableOptions);
  return (state: StateWithHistoryAndTimestamp, action: Action) => {
    return { ...undoableReducer(state, action), timestamp: Date.now() };
  };
}

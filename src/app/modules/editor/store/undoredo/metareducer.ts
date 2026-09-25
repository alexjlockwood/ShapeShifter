import { Action, ActionReducer } from 'app/modules/editor/store';
import { ActionModeActionTypes } from 'app/modules/editor/store/actionmode/actions';
import { BatchAction, BatchActionTypes } from 'app/modules/editor/store/batch/actions';
import { PlaybackActionTypes } from 'app/modules/editor/store/playback/actions';
import { EditorState } from 'app/modules/editor/store/reducer';
import { ThemeActionTypes } from 'app/modules/editor/store/theme/actions';
import type { UnknownAction } from 'redux';
import undoable, {
  ActionTypes as UndoActionTypes,
  StateWithHistory,
  UndoableOptions,
} from 'redux-undo';

const UNDO_HISTORY_SIZE = 30;
const UNDO_DEBOUNCE_MILLIS = 1000;
const UNDO_EXCLUDED_ACTIONS: ReadonlySet<string> = new Set([
  PlaybackActionTypes.SetIsSlowMotion,
  PlaybackActionTypes.SetIsPlaying,
  PlaybackActionTypes.SetIsRepeating,
  PlaybackActionTypes.SetCurrentTime,
  ActionModeActionTypes.SetActionMode,
  ActionModeActionTypes.SetActionModeHover,
  ThemeActionTypes.SetTheme,
]);
const UNDO_REDO_ACTIONS: ReadonlySet<string> = new Set([
  UndoActionTypes.UNDO,
  UndoActionTypes.REDO,
  UndoActionTypes.JUMP,
  UndoActionTypes.JUMP_TO_PAST,
  UndoActionTypes.JUMP_TO_FUTURE,
]);

let groupCounter = 1;

export interface StateWithHistoryAndTimestamp extends StateWithHistory<EditorState> {
  // The time of the most recent action that was recorded in the undo history.
  timestamp: number;
}

type StateReducer = ActionReducer<StateWithHistoryAndTimestamp>;
type EditorStateReducer = ActionReducer<EditorState>;

/** Batches are recorded unless every action in them is excluded. */
function isRecorded(action: Action) {
  const actions =
    action.type === BatchActionTypes.BatchAction ? (action as BatchAction).payload : [action];
  return actions.some(a => !UNDO_EXCLUDED_ACTIONS.has(a.type));
}

export function metaReducer(reducer: EditorStateReducer): StateReducer {
  const undoableReducer = undoable(reducer, {
    limit: UNDO_HISTORY_SIZE,
    filter: (action: Action) => isRecorded(action),
    groupBy: (action: Action, currState: EditorState, prevState: StateWithHistory<EditorState>) => {
      const { timestamp } = prevState as StateWithHistoryAndTimestamp;
      if (Date.now() - timestamp < UNDO_DEBOUNCE_MILLIS) {
        return groupCounter;
      }
      groupCounter++;
      return undefined;
    },
  } as UndoableOptions);
  return (state: StateWithHistoryAndTimestamp | undefined, action: Action) => {
    const history = undoableReducer(state, action as UnknownAction);
    let { present } = history;
    if (state && UNDO_REDO_ACTIONS.has(action.type)) {
      // The theme is a preference, so undoing edits shouldn't change it.
      present = { ...present, theme: state.present.theme };
    }
    // Excluded actions (e.g. the current time changing on every frame of playback) shouldn't
    // keep edits made more than a second apart from getting their own undo steps.
    const timestamp = !state || isRecorded(action) ? Date.now() : state.timestamp;
    return { ...history, present, timestamp };
  };
}

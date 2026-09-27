import { Action, ActionReducer } from 'app/modules/editor/store';
import { ActionModeActionTypes } from 'app/modules/editor/store/actionmode/actions';
import { BatchAction, BatchActionTypes } from 'app/modules/editor/store/batch/actions';
import { PlaybackActionTypes } from 'app/modules/editor/store/playback/actions';
import { EditorState } from 'app/modules/editor/store/reducer';
import { ResetActionTypes } from 'app/modules/editor/store/reset/actions';
import { ThemeActionTypes } from 'app/modules/editor/store/theme/actions';
import { UndoRedoActionTypes } from 'app/modules/editor/store/undoredo/actions';
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

// Actions that always get an undo step of their own, however soon they come after the last one.
// Loading a project replaces everything, so undoing an edit made right after it shouldn't undo
// the load too. IsolateUndoStep gives any batch it's in the same treatment.
const UNDO_ISOLATED_ACTIONS: ReadonlySet<string> = new Set([
  ResetActionTypes.ResetWorkspace,
  UndoRedoActionTypes.IsolateUndoStep,
]);

function unbatch(action: Action) {
  return action.type === BatchActionTypes.BatchAction ? (action as BatchAction).payload : [action];
}

/**
 * Batches are recorded unless every action in them is excluded, or one of them is SkipUndoStep.
 * redux-undo keeps the last recorded state while it skips actions, so the next recorded one starts
 * its undo step from there.
 */
function isRecorded(action: Action) {
  const actions = unbatch(action);
  return (
    !actions.some(a => a.type === UndoRedoActionTypes.SkipUndoStep) &&
    actions.some(a => !UNDO_EXCLUDED_ACTIONS.has(a.type))
  );
}

function isIsolated(action: Action) {
  return unbatch(action).some(a => UNDO_ISOLATED_ACTIONS.has(a.type));
}

/**
 * Returns the state as of the last recorded action, which is where undo goes back to. It's the
 * present state unless actions have been skipped since, e.g. previews and playback.
 */
export function getLastRecordedState(state: StateWithHistoryAndTimestamp): EditorState {
  return state._latestUnfiltered ?? state.present;
}

export function metaReducer(reducer: EditorStateReducer): StateReducer {
  const undoableReducer = undoable(reducer, {
    limit: UNDO_HISTORY_SIZE,
    filter: (action: Action) => isRecorded(action),
    groupBy: (action: Action, currState: EditorState, prevState: StateWithHistory<EditorState>) => {
      // An action more than a second after the last recorded one starts a new group, and the
      // actions that follow it are merged into its undo step. (Returning undefined instead would
      // give the first action a step of its own.)
      const { timestamp } = prevState as StateWithHistoryAndTimestamp;
      if (isIsolated(action) || Date.now() - timestamp >= UNDO_DEBOUNCE_MILLIS) {
        groupCounter++;
      }
      return groupCounter;
    },
  } as UndoableOptions);
  return (state: StateWithHistoryAndTimestamp | undefined, action: Action) => {
    const history = undoableReducer(state, action as UnknownAction);
    if (state && history === state) {
      // Nothing changed, e.g. undo with nothing to undo. That shouldn't count as a recent edit.
      return state;
    }
    let { present } = history;
    if (state && UNDO_REDO_ACTIONS.has(action.type)) {
      // The theme is a preference, so undoing edits shouldn't change it.
      present = { ...present, theme: state.present.theme };
    }
    // Excluded actions (e.g. the current time changing on every frame of playback) shouldn't
    // keep edits made more than a second apart from getting their own undo steps. The action
    // after an isolated one starts a new step too.
    let timestamp = state ? state.timestamp : Date.now();
    if (isIsolated(action)) {
      timestamp = 0;
    } else if (!state || isRecorded(action)) {
      timestamp = Date.now();
    }
    return { ...history, present, timestamp };
  };
}

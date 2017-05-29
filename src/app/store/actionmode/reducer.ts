import { State } from '../reducer';
import * as actions from './actions';
import { Action, ActionReducer } from '@ngrx/store';

// Meta-reducer that intercepts action mode actions and modifies any corresponding state.
export function wrapActionMode(reducer: ActionReducer<State>): ActionReducer<State> {
  return (state: State, action: actions.Actions) => {
    switch (action.type) {
      case actions.REVERSE_SELECTED_SUBPATHS: {
        // TODO: implement this
      }
      case actions.SHIFT_BACK_SELECTED_SUBPATHS: {
        // TODO: implement this
      }
      case actions.SHIFT_FORWARD_SELECTED_SUBPATHS: {
        // TODO: implement this
      }
      case actions.DELETE_SELECTED_SUBPATHS: {
        // TODO: implement this
      }
      case actions.DELETE_SELECTED_SEGMENTS: {
        // TODO: implement this
      }
      case actions.DELETE_SELECTED_POINTS: {
        // TODO: implement this
      }
      case actions.SHIFT_POINT_TO_FRONT: {
        // TODO: implement this
      }
      case actions.SPLIT_COMMAND_IN_HALF_HOVER: {
        // TODO: implement this
      }
      case actions.SPLIT_COMMAND_IN_HALF_CLICK: {
        // TODO: implement this
      }
    }
    return reducer(state, action)
  };
}

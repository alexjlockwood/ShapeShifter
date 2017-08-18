import { ToolMode } from 'app/model/toolmode';

import * as actions from './actions';

export interface State {
  readonly toolMode: ToolMode;
}

export function buildInitialState() {
  return {
    toolMode: ToolMode.Select,
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  if (action.type === actions.SET_TOOL_MODE) {
    const { toolMode } = action.payload;
    return { ...state, toolMode };
  }
  return state;
}

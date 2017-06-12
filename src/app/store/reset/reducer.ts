import * as actions from './actions';

export interface State {
  readonly isBeingReset: boolean;
}

export function buildInitialState() {
  return {
    isBeingReset: false,
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  if (action.type === actions.RESET_WORKSPACE) {
    return { ...state, isBeingReset: true };
  }
  const { isBeingReset } = state;
  if (isBeingReset) {
    return { ...state, isBeingReset: false };
  }
  return state;
}

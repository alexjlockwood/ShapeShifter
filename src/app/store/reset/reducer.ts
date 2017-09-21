import * as actions from './actions';

export interface State {
  readonly isBeingReset: boolean;
}

export function buildInitialState(): State {
  return {
    isBeingReset: false,
  };
}

export function reducer(state = buildInitialState(), action: actions.Actions): State {
  if (action.type === actions.RESET_WORKSPACE) {
    return { ...state, isBeingReset: true };
  }
  const { isBeingReset } = state;
  if (isBeingReset) {
    return { ...state, isBeingReset: false };
  }
  return state;
}

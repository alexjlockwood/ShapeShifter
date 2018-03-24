import { ResetActionTypes, ResetActions } from './actions';

// TODO: remove this 'isBeingReset' flag... see TODO in layer timeline component
export interface State {
  readonly isBeingReset: boolean;
}

export function buildInitialState() {
  return {
    isBeingReset: false,
  } as State;
}

export function reducer(state = buildInitialState(), action: ResetActions) {
  if (action.type === ResetActionTypes.ResetWorkspace) {
    return { ...state, isBeingReset: true };
  }
  const { isBeingReset } = state;
  if (isBeingReset) {
    return { ...state, isBeingReset: false };
  }
  return state;
}

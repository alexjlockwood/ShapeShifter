import { User } from 'app/shared/models/firestore';

import { AuthActionTypes, AuthActions } from './auth.actions';

export interface State {
  readonly user: User | undefined;
}

export function buildInitialState() {
  return {
    user: undefined,
  } as State;
}

export function reducer(state = buildInitialState(), action: AuthActions) {
  switch (action.type) {
    case AuthActionTypes.SetUser:
      return { ...state, user: action.user };
    case AuthActionTypes.SignoutSuccess:
      return { ...state, user: undefined };
  }
  return state;
}

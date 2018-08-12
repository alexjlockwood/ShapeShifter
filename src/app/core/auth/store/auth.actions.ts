import { Action } from '@ngrx/store';
import { User } from 'app/shared/models/firestore';

export enum AuthActionTypes {
  SetUser = '[auth] SetUser',
}

export class SetUser implements Action {
  readonly type = AuthActionTypes.SetUser;
  constructor(readonly user: User | undefined) {}
}

export type AuthActions = SetUser;

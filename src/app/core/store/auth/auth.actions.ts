import { Action } from '@ngrx/store';
import { User } from 'app/shared/models/firestore';

export enum AuthActionTypes {
  SetUser = '[auth] SetUser',
  ShowSignoutDialog = '[auth] ShowSignoutDialog',
  SignoutDialogConfirmed = '[auth] SignoutDialogConfirmed',
  SignoutDialogCanceled = '[auth] SignoutDialogCanceled',
  SignoutSuccess = '[auth] SignoutSuccess',
  SignoutFailure = '[auth] SignoutFailure',
}

export class SetUser implements Action {
  readonly type = AuthActionTypes.SetUser;
  constructor(readonly user: User | undefined) {}
}

export class ShowSignoutDialog implements Action {
  readonly type = AuthActionTypes.ShowSignoutDialog;
}

export class SignoutDialogConfirmed implements Action {
  readonly type = AuthActionTypes.SignoutDialogConfirmed;
}

export class SignoutDialogCanceled implements Action {
  readonly type = AuthActionTypes.SignoutDialogCanceled;
}

export class SignoutSuccess implements Action {
  readonly type = AuthActionTypes.SignoutSuccess;
}

export class SignoutFailure implements Action {
  readonly type = AuthActionTypes.SignoutFailure;
}

export type AuthActions =
  | SetUser
  | ShowSignoutDialog
  | SignoutDialogConfirmed
  | SignoutDialogCanceled
  | SignoutSuccess
  | SignoutFailure;

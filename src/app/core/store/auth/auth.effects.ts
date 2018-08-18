import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Router } from '@angular/router';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { AngularFireAuth } from 'angularfire2/auth';
import { AngularFirestore } from 'angularfire2/firestore';
import { SigninDialogComponent } from 'app/shared/components/signin-dialog';
import { SignoutDialogComponent } from 'app/shared/components/signout-dialog';
import { User } from 'app/shared/models/firestore';
import * as firebase from 'firebase/app';
import { from, of } from 'rxjs';
import { catchError, exhaustMap, map, switchMap, tap } from 'rxjs/operators';

import {
  AuthActionTypes,
  ShowSigninDialog,
  ShowSignoutDialog,
  SigninDialogCanceled,
  SigninDialogConfirmed,
  SigninFailure,
  SigninSuccess,
  SignoutDialogCanceled,
  SignoutDialogConfirmed,
  SignoutFailure,
  SignoutSuccess,
} from './auth.actions';

@Injectable()
export class AuthEffects {
  @Effect()
  showSigninDialog$ = this.actions$.pipe(
    ofType<ShowSigninDialog>(AuthActionTypes.ShowSigninDialog),
    exhaustMap(() =>
      this.matDialog
        .open<SigninDialogComponent, undefined, boolean>(SigninDialogComponent)
        .beforeClose()
        .pipe(map(res => (res ? new SigninDialogConfirmed() : new SigninDialogCanceled()))),
    ),
  );

  @Effect({ dispatch: false })
  signinDialogConfirmed$ = this.actions$.pipe(
    ofType<SigninDialogConfirmed>(AuthActionTypes.SigninDialogConfirmed),
    exhaustMap(() =>
      this.signInWithGoogle().pipe(
        map(() => new SigninSuccess()),
        catchError(error => {
          console.error('Unable to sign in', error);
          return of(new SigninFailure());
        }),
      ),
    ),
  );

  @Effect()
  showSignoutDialog$ = this.actions$.pipe(
    ofType<ShowSignoutDialog>(AuthActionTypes.ShowSignoutDialog),
    exhaustMap(() =>
      this.matDialog
        .open<SignoutDialogComponent, undefined, boolean>(SignoutDialogComponent)
        .beforeClose()
        .pipe(map(res => (res ? new SignoutDialogConfirmed() : new SignoutDialogCanceled()))),
    ),
  );

  @Effect({ dispatch: false })
  signoutDialogConfirmed$ = this.actions$.pipe(
    ofType<SignoutDialogConfirmed>(AuthActionTypes.SignoutDialogConfirmed),
    exhaustMap(() =>
      from(this.angularFireAuth.auth.signOut()).pipe(
        map(() => new SignoutSuccess()),
        // TODO: figure out if we should redirect in this case
        tap(() => this.router.navigate(['/'])),
        catchError(error => {
          console.error('Unable to sign out', error);
          return of(new SignoutFailure());
        }),
      ),
    ),
  );

  constructor(
    private readonly actions$: Actions,
    private readonly angularFireAuth: AngularFireAuth,
    private readonly angularFirestore: AngularFirestore,
    private readonly router: Router,
    private readonly matDialog: MatDialog,
  ) {}

  private signInWithGoogle() {
    return this.signInWithOAuth(new firebase.auth.GoogleAuthProvider());
  }

  private signInWithOAuth(provider: firebase.auth.AuthProvider) {
    return from(this.angularFireAuth.auth.signInWithPopup(provider)).pipe(
      switchMap(credential => this.updateUserData(credential.user)),
    );
  }

  private updateUserData(user: firebase.User) {
    const { uid: id, email, photoURL, displayName } = user;
    return this.angularFirestore
      .doc<User>(`users/${id}`)
      .set({ id, email, photoURL, displayName }, { merge: true });
  }
}

import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Router } from '@angular/router';
import { Actions, Effect } from '@ngrx/effects';
import { AuthService } from 'app/core/services/auth/auth.service';
import { SignoutDialogComponent } from 'app/shared/components/signout-dialog';
import { from, of } from 'rxjs';
import { catchError, exhaustMap, map, tap } from 'rxjs/operators';

import {
  AuthActionTypes,
  ShowSignoutDialog,
  SignoutDialogCanceled,
  SignoutDialogConfirmed,
  SignoutFailure,
  SignoutSuccess,
} from './auth.actions';

@Injectable()
export class AuthEffects {
  //   @Effect()
  //   login$ = this.actions$.ofType<Login>(AuthActionTypes.Login).pipe(
  //     map(action => action.payload),
  //     exhaustMap(auth =>
  //       this.authService.login(auth).pipe(
  //         map(user => new LoginSuccess({ user })),
  //         catchError(error => of(new LoginFailure(error))),
  //       ),
  //     ),
  //   );

  //   @Effect({ dispatch: false })
  //   loginRedirect$ = this.actions$
  //     .ofType<LoginSuccess>(AuthActionTypes.LoginSuccess)
  //     .pipe(tap(() => this.router.navigate(['/books'])));

  @Effect()
  showSignoutDialog$ = this.actions$
    .ofType<ShowSignoutDialog>(AuthActionTypes.ShowSignoutDialog)
    .pipe(
      exhaustMap(() =>
        this.matDialog
          .open(SignoutDialogComponent)
          .afterClosed()
          .pipe(
            map(confirmed => {
              if (confirmed) {
                return new SignoutDialogConfirmed();
              } else {
                return new SignoutDialogCanceled();
              }
            }),
          ),
      ),
    );

  @Effect({ dispatch: false })
  signoutDialogConfirmed$ = this.actions$
    .ofType<SignoutDialogConfirmed>(AuthActionTypes.SignoutDialogConfirmed)
    .pipe(
      exhaustMap(() =>
        from(this.authService.signOut()).pipe(
          map(() => {
            // TODO: figure out if we should redirect in this case
            this.router.navigate(['/']);
            return new SignoutSuccess();
          }),
          catchError(() => {
            console.error('Unable to login');
            return of(new SignoutFailure());
          }),
        ),
      ),
    );

  constructor(
    private readonly actions$: Actions,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly matDialog: MatDialog,
  ) {}
}

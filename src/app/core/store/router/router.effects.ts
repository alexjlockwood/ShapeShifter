import { Location } from '@angular/common';
import { Injectable } from '@angular/core';
import { ActivationEnd, Router } from '@angular/router';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, map, tap } from 'rxjs/operators';

import { Back, Change, Forward, Go, RouterActionTypes } from './router.actions';

@Injectable()
export class RouterEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly router: Router,
    private readonly location: Location,
    // TODO: replace 'any' with the correct type
    private readonly store: Store<any>,
  ) {
    this.router.events
      .pipe(filter(event => event instanceof ActivationEnd))
      .subscribe((event: ActivationEnd) =>
        this.store.dispatch(
          new Change({
            params: { ...event.snapshot.params },
            path: event.snapshot.routeConfig.path,
          }),
        ),
      );
  }

  @Effect({ dispatch: false })
  navigate$ = this.actions$.pipe(
    ofType<Go>(RouterActionTypes.Go),
    map(action => action.payload),
    tap(({ path, queryParams, extras }) => this.router.navigate(path, { queryParams, ...extras })),
  );

  @Effect({ dispatch: false })
  navigateBack$ = this.actions$.pipe(
    ofType<Back>(RouterActionTypes.Back),
    tap(() => this.location.back()),
  );

  @Effect({ dispatch: false })
  navigateForward$ = this.actions$.pipe(
    ofType<Forward>(RouterActionTypes.Forward),
    tap(() => this.location.forward()),
  );
}

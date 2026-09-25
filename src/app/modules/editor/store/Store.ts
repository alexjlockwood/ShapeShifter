import type { Store as ReduxStore } from 'redux';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import type { State } from './reducer';

export interface Action {
  readonly type: string;
}

export type ActionReducer<T, A extends Action = Action> = (state: T | undefined, action: A) => T;

/**
 * Wraps the Redux store with the select/dispatch API that the app used with ngrx. Selecting
 * emits the current value immediately, and then again whenever it changes.
 */
export class Store<S = State> {
  private readonly state$: Observable<S>;

  constructor(readonly redux: ReduxStore<S, Action>) {
    this.state$ = new Observable<S>(subscriber => {
      subscriber.next(redux.getState());
      return redux.subscribe(() => subscriber.next(redux.getState()));
    });
  }

  select<T>(selector: (state: S) => T) {
    return this.state$.pipe(map(selector), distinctUntilChanged());
  }

  dispatch(action: Action) {
    this.redux.dispatch(action);
  }

  getState() {
    return this.redux.getState();
  }
}

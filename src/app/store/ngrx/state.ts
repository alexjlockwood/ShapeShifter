import { BehaviorSubject } from 'rxjs';
import { observeOn, scan, withLatestFrom } from 'rxjs/operators';
import { queue } from 'rxjs/scheduler/queue';

import { Action, Dispatcher } from './dispatcher';
import { ActionReducer, Reducer } from './reducer';

export class State<T> extends BehaviorSubject<T> {
  constructor(initialState: T, action$: Dispatcher, reducer$: Reducer) {
    super(initialState);
    action$
      .pipe(
        observeOn(queue),
        withLatestFrom(reducer$),
        scan<[Action, ActionReducer<any>], T>(
          (state, [action, reducer]) => reducer(state, action),
          initialState,
        ),
      )
      .subscribe(value => this.next(value));
  }
}

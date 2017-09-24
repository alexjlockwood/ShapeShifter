import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { observeOn } from 'rxjs/operator/observeOn';
import { scan } from 'rxjs/operator/scan';
import { withLatestFrom } from 'rxjs/operator/withLatestFrom';
import { queue } from 'rxjs/scheduler/queue';

import { Dispatcher } from './dispatcher';
import { Reducer } from './reducer';

export class State<T> extends BehaviorSubject<T> {
  constructor(_initialState: T, action$: Dispatcher, reducer$: Reducer) {
    super(_initialState);

    const actionInQueue$ = observeOn.call(action$, queue);
    const actionAndReducer$ = withLatestFrom.call(actionInQueue$, reducer$);
    const state$ = scan.call(
      actionAndReducer$,
      (state, [action, reducer]) => {
        return reducer(state, action);
      },
      _initialState,
    );

    state$.subscribe(value => this.next(value));
  }
}

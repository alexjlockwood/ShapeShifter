import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Operator } from 'rxjs/Operator';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { Action } from './dispatcher';
import { ActionReducer } from './reducer';

export class Store<T> extends Observable<T> implements Observer<Action> {
  constructor(
    private readonly dispatcher: Observer<Action>,
    private readonly reducer: Observer<ActionReducer<any>>,
    state$: Observable<any>,
  ) {
    super();
    this.source = state$;
  }

  select<R>(mapFn: (state: T) => R) {
    return this.pipe(map(mapFn), distinctUntilChanged());
  }

  lift<R>(operator: Operator<T, R>): Store<R> {
    const store = new Store<R>(this.dispatcher, this.reducer, this);
    store.operator = operator;
    return store;
  }

  replaceReducer(reducer: ActionReducer<any>) {
    this.reducer.next(reducer);
  }

  dispatch(action: Action) {
    this.dispatcher.next(action);
  }

  next(action: Action) {
    this.dispatcher.next(action);
  }

  error(err: any) {
    this.dispatcher.error(err);
  }

  complete() {}
}

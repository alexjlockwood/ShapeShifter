import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Operator } from 'rxjs/Operator';

import { Action } from './dispatcher';
import { ActionReducer } from './reducer';
import { SelectSignature, select } from './select';

export class Store<T> extends Observable<T> implements Observer<Action> {
  constructor(
    private readonly dispatcher: Observer<Action>,
    private readonly reducer: Observer<ActionReducer<any>>,
    state$: Observable<any>,
  ) {
    super();
    this.source = state$;
  }

  select: SelectSignature<T> = select.bind(this);

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

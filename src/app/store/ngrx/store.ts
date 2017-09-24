import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Operator } from 'rxjs/Operator';
import { Subscriber } from 'rxjs/Subscriber';

import { Action } from './dispatcher';
import { ActionReducer } from './reducer';
import { SelectSignature, select } from './select';
import { State } from './state';

export class Store<T> extends Observable<T> implements Observer<Action> {
  constructor(
    private _dispatcher: Observer<Action>,
    private _reducer: Observer<ActionReducer<any>>,
    state$: Observable<any>,
  ) {
    super();

    this.source = state$;
  }

  select: SelectSignature<T> = select.bind(this);

  lift<R>(operator: Operator<T, R>): Store<R> {
    const store = new Store<R>(this._dispatcher, this._reducer, this);
    store.operator = operator;
    return store;
  }

  replaceReducer(reducer: ActionReducer<any>) {
    this._reducer.next(reducer);
  }

  dispatch(action: Action) {
    this._dispatcher.next(action);
  }

  next(action: Action) {
    this._dispatcher.next(action);
  }

  error(err: any) {
    this._dispatcher.error(err);
  }

  complete() {
    // noop
  }
}

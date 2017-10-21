import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { Action, Dispatcher } from './dispatcher';

export type ActionReducer<T> = (state: T, action: Action) => T;

export class Reducer extends BehaviorSubject<ActionReducer<any>> {
  static REPLACE = '@ngrx/store/replace-reducer';

  constructor(private readonly dispatcher: Dispatcher, initialReducer: ActionReducer<any>) {
    super(initialReducer);
  }

  replaceReducer(reducer: ActionReducer<any>) {
    this.next(reducer);
  }

  next(reducer: ActionReducer<any>) {
    super.next(reducer);
    this.dispatcher.dispatch({ type: Reducer.REPLACE });
  }
}

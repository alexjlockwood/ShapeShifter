import { BehaviorSubject } from 'rxjs/BehaviorSubject';

export interface Action<T = any> {
  type: string;
  payload?: T;
}

export class Dispatcher extends BehaviorSubject<Action> {
  static INIT = '@ngrx/store/init';

  constructor() {
    super({ type: Dispatcher.INIT });
  }

  dispatch(action: Action) {
    this.next(action);
  }

  complete() {}
}

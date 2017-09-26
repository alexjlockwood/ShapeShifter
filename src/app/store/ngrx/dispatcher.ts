import { BehaviorSubject } from 'rxjs/BehaviorSubject';

export interface Action<T = any> {
  type: string;
  // TODO: remove this field?
  payload?: T;
}

export class Dispatcher extends BehaviorSubject<Action> {
  static INIT = '@ngrx/store/init';

  constructor() {
    super({ type: Dispatcher.INIT });
  }

  dispatch(action: Action): void {
    this.next(action);
  }

  complete() {}
}

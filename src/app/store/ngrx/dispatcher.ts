import { BehaviorSubject } from 'rxjs/BehaviorSubject';

export const INIT_ACTION = '@ngrx/store/init';

export interface Action<T = any> {
  type: string;
  // TODO: remove this field?
  payload?: T;
}

export class Dispatcher extends BehaviorSubject<Action> {
  static INIT = INIT_ACTION;

  constructor() {
    super({ type: Dispatcher.INIT });
  }

  dispatch(action: Action): void {
    this.next(action);
  }

  complete() {}
}

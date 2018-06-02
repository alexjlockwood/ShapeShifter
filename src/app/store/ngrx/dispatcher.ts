import { BehaviorSubject } from 'rxjs';

export interface Action {
  type: string;
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

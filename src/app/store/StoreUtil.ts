import { Store, State } from '.';

export function getState(store: Store<State>) {
  let state: State;
  store.take(1).subscribe(s => state = s).unsubscribe();
  return state;
}

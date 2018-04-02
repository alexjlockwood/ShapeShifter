import { ActionReducer } from 'app/store/ngrx';
import { storeLogger } from 'ngrx-store-logger';

/** Meta reducer that logs store operations to the console. */
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return storeLogger({ collapsed: true })(reducer);
}

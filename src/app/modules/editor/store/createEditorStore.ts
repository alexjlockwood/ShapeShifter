import {
  applyMiddleware,
  combineReducers,
  compose,
  legacy_createStore,
  type Middleware,
  type Reducer,
  type StoreEnhancer,
} from 'redux';

import * as metaLogger from './logger/metareducer';
import { metaReducers, reducers, type State } from './reducer';
import { type Action, type ActionReducer, Store } from './Store';

/** Redux only accepts plain object actions, but the app's actions are class instances. */
const plainActionMiddleware: Middleware = () => next => action =>
  next(Object.getPrototypeOf(action) === Object.prototype ? action : { ...(action as object) });

/**
 * Defers actions dispatched while subscribers are being notified until all of them have seen
 * the current state, which is how ngrx delivered them. Otherwise the subscribers notified last
 * would skip over short-lived states (e.g. isBeingReset).
 */
const queueNestedDispatches: StoreEnhancer = createStore => (reducer, preloadedState) => {
  const store = createStore(reducer, preloadedState);
  const queue: Parameters<typeof store.dispatch>[0][] = [];
  let isNotifying = false;
  const dispatch: typeof store.dispatch = action => {
    if (isNotifying) {
      queue.push(action);
      return action;
    }
    isNotifying = true;
    try {
      store.dispatch(action);
      for (let next = queue.shift(); next; next = queue.shift()) {
        store.dispatch(next);
      }
    } finally {
      isNotifying = false;
      queue.length = 0;
    }
    return action;
  };
  return { ...store, dispatch };
};

type AnyReducer = ActionReducer<any>;

export function createEditorStore({ logActions = false } = {}) {
  const allMetaReducers: ((reducer: AnyReducer) => AnyReducer)[] = logActions
    ? [metaLogger.metaReducer, ...metaReducers]
    : metaReducers;
  // Matches the order that ngrx applies meta reducers, where the first one is the outermost.
  const rootReducer = allMetaReducers.reduceRight(
    (reducer, metaReducer) => metaReducer(reducer),
    combineReducers(reducers) as AnyReducer,
  );
  const reduxStore = legacy_createStore(
    rootReducer as Reducer<State, Action>,
    compose(queueNestedDispatches, applyMiddleware(plainActionMiddleware)) as StoreEnhancer,
  );
  return new Store<State>(reduxStore);
}

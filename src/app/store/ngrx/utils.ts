import { ActionReducer } from './reducer';

export function combineReducers(reducers: any): ActionReducer<any> {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};
  for (const key of reducerKeys) {
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  const finalReducerKeys = Object.keys(finalReducers);
  return function combination(state = {}, action) {
    let hasChanged = false;
    const nextState = {};
    for (const key of finalReducerKeys) {
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}

export interface ComposeSignature {
  <A>(): (i: A) => A;
  <A, B>(b: (i: A) => B): (i: A) => B;
  <A, B, C>(c: (i: B) => C, b: (i: A) => B): (i: A) => C;
  <A, B, C, D>(d: (i: C) => D, c: (i: B) => C, b: (i: A) => B): (i: A) => D;
  <A, B, C, D, E>(e: (i: D) => E, d: (i: C) => D, c: (i: B) => C, b: (i: A) => B): (i: A) => E;
  <A, B, C, D, E, F>(
    f: (i: E) => F,
    e: (i: D) => E,
    d: (i: C) => D,
    c: (i: B) => C,
    b: (i: A) => B,
  ): (i: A) => F;
  (...fns: any[]): (input: any) => any;
}

export const compose: ComposeSignature = (...functions) => {
  return function(arg) {
    if (functions.length === 0) {
      return arg;
    }
    const last = functions[functions.length - 1];
    const rest = functions.slice(0, -1);
    return rest.reduceRight((composed, fn) => fn(composed), last(arg));
  };
};

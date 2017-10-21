import { Observable } from 'rxjs/Observable';
import { distinctUntilChanged } from 'rxjs/operator/distinctUntilChanged';
import { map } from 'rxjs/operator/map';
import { pluck } from 'rxjs/operator/pluck';

export interface SelectSignature<T> {
  <R>(...paths: string[]): Observable<R>;
  <R>(mapFn: (state: T) => R): Observable<R>;
}

export function select<T, R>(
  pathOrMapFn: string | ((state: T) => R),
  ...paths: string[]
): Observable<R> {
  let mapped$: Observable<R>;
  if (typeof pathOrMapFn === 'string') {
    mapped$ = pluck.call(this, pathOrMapFn, ...paths);
  } else if (typeof pathOrMapFn === 'function') {
    mapped$ = map.call(this, pathOrMapFn);
  } else {
    throw new TypeError(
      `Unexpected type ${typeof pathOrMapFn} in select operator,` +
        ` expected 'string' or 'function'`,
    );
  }
  return distinctUntilChanged.call(mapped$);
}

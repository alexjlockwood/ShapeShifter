import { Action } from '@ngrx/store';
import { OperatorFunction } from 'rxjs';
import { filter } from 'rxjs/operators';

import { RouterActionTypes, RouterActions } from './router.actions';

export function ofRoute(route: string | string[]): OperatorFunction<Action, Action> {
  return filter((action: RouterActions) => {
    if (action.type !== RouterActionTypes.Change) {
      return false;
    }
    const { path } = action.payload;
    return Array.isArray(route) ? route.includes(path) : route === path;
  });
}

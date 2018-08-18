import { Action } from '@ngrx/store';
import { OperatorFunction } from 'rxjs';
import { filter } from 'rxjs/operators';

import { RouterActionTypes, RouterActions } from './router.actions';

export function ofRoute(route: string | string[]): OperatorFunction<Action, Action> {
  return filter((action: RouterActions) => {
    if (action.type === RouterActionTypes.Change) {
      const routeAction = action;
      const routePath = routeAction.payload.path;
      if (Array.isArray(route)) {
        return route.includes(routePath);
      } else {
        return routePath === route;
      }
    }
    return false;
  });
}

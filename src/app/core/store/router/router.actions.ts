import { NavigationExtras } from '@angular/router';
import { Action } from '@ngrx/store';

export enum RouterActionTypes {
  Go = '[router] Go',
  Back = '[router] Back',
  Forward = '[router] Forward',
  Change = '[router] Change',
}

export type RouterActions = Go | Back | Forward | Change;

export class Go implements Action {
  readonly type = '[router] Go';
  constructor(
    readonly payload: Readonly<{
      path: any[];
      queryParams?: object;
      extras?: NavigationExtras;
    }>,
  ) {}
}

export class Back implements Action {
  readonly type = '[router] Back';
}

export class Forward implements Action {
  readonly type = '[router] Forward';
}

export class Change implements Action {
  readonly type = '[router] Change';
  constructor(readonly payload: Readonly<{ params: any; path: string }>) {}
}

import { Action } from '@ngrx/store';

export const SET_THEME = '__theme__SET_THEME';

export class SetTheme implements Action {
  readonly type = SET_THEME;
  readonly payload: { isDarkTheme: boolean };
  constructor(isDarkTheme: boolean) {
    this.payload = { isDarkTheme };
  }
}

export type Actions = SetTheme;

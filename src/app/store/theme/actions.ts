import { Action } from 'app/store/ngrx';

import { ThemeType } from './reducer';

export const SET_THEME = '__theme__SET_THEME';

export class SetTheme implements Action {
  readonly type = SET_THEME;
  readonly payload: { themeType: ThemeType };
  constructor(themeType: ThemeType) {
    this.payload = { themeType };
  }
}

export type Actions = SetTheme;

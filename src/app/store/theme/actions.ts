import { Action } from 'app/store';

import { ThemeType } from './reducer';

export enum ThemeActionTypes {
  SetTheme = '__theme__SET_THEME',
}

export class SetTheme implements Action {
  readonly type = ThemeActionTypes.SetTheme;
  readonly payload: { themeType: ThemeType };
  constructor(themeType: ThemeType) {
    this.payload = { themeType };
  }
}

export type ThemeActions = SetTheme;

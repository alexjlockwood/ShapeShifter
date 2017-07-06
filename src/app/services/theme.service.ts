import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { State, Store } from 'app/store';
import { SetTheme } from 'app/store/theme/actions';
import { ThemeType } from 'app/store/theme/reducer';
import { getThemeType } from 'app/store/theme/selectors';

// TODO: make the canvas theme aware
// TODO: change the animation block green color

const LIGHT_PRIMARY_TEXT = 'rgba(0, 0, 0, 0.87)';
const DARK_PRIMARY_TEXT = 'rgba(255, 255, 255, 1)';
const LIGHT_SECONDARY_TEXT = 'rgba(0, 0, 0, 0.54)';
const DARK_SECONDARY_TEXT = 'rgba(255, 255, 255, 0.7)';
const LIGHT_DISABLED_TEXT = 'rgba(0, 0, 0, 0.26)';
const DARK_DISABLED_TEXT = 'rgba(255, 255, 255, 0.3)';
const LIGHT_DIVIDER_TEXT = 'rgba(0, 0, 0, 0.12)';
const DARK_DIVIDER_TEXT = 'rgba(255, 255, 255, 0.12)';

/**
 * A simple service that provides an interface for making theme changes.
 */
@Injectable()
export class ThemeService {
  constructor(private readonly store: Store<State>) {}

  setTheme(themeType: ThemeType) {
    this.store.dispatch(new SetTheme(themeType));
  }

  toggleTheme() {
    this.setTheme(this.getThemeType().themeType === 'dark' ? 'light' : 'dark');
  }

  getThemeType() {
    let result: { themeType: ThemeType; isInitialPageLoad: boolean };
    this.store.select(getThemeType).first().subscribe(res => (result = res));
    return result;
  }

  asObservable() {
    return this.store.select(getThemeType);
  }

  getPrimaryTextColor() {
    return this.getThemeType().themeType === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT;
  }

  getSecondaryTextColor() {
    return this.getThemeType().themeType === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT;
  }

  getDisabledTextColor() {
    return this.getThemeType().themeType === 'dark' ? DARK_DISABLED_TEXT : LIGHT_DISABLED_TEXT;
  }

  getDividerTextColor() {
    return this.getThemeType().themeType === 'dark' ? DARK_DIVIDER_TEXT : LIGHT_DIVIDER_TEXT;
  }
}

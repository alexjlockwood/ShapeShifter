import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { State, Store } from 'app/store';
import { SetTheme } from 'app/store/theme/actions';
import { ThemeType } from 'app/store/theme/reducer';
import { getThemeType } from 'app/store/theme/selectors';

/**
 * A simple service that provides an interface for making theme changes.
 */
@Injectable()
export class ThemeService {
  constructor(private readonly store: Store<State>) {}

  toggleTheme() {
    this.store.dispatch(new SetTheme(this.getThemeType().themeType === 'dark' ? 'light' : 'dark'));
  }

  getThemeType() {
    let result: { themeType: ThemeType; isInitialPageLoad: boolean };
    this.store.select(getThemeType).first().subscribe(res => (result = res));
    return result;
  }

  asObservable() {
    return this.store.select(getThemeType);
  }
}

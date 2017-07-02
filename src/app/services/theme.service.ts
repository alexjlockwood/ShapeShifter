import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { State, Store } from 'app/store';
import { SetTheme } from 'app/store/theme/actions';
import { isDarkTheme } from 'app/store/theme/selectors';
import { OutputSelector } from 'reselect';

/**
 * A simple service that provides an interface for making theme changes.
 */
@Injectable()
export class ThemeService {
  constructor(private readonly store: Store<State>) {}

  isDarkTheme() {
    return this.queryStore(isDarkTheme);
  }

  toggleTheme() {
    this.store.dispatch(new SetTheme(!this.isDarkTheme()));
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store.select(selector).first().subscribe(o => (obj = o));
    return obj;
  }
}

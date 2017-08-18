import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { ToolMode } from 'app/model/toolmode';
import { State, Store } from 'app/store';
import { SetToolMode } from 'app/store/toolmode/actions';
import { getToolMode } from 'app/store/toolmode/selectors';

/**
 * A simple service that provides an interface for tool panel changes.
 */
@Injectable()
export class ToolModeService {
  constructor(private readonly store: Store<State>) {}

  setToolMode(toolMode: ToolMode) {
    this.store.dispatch(new SetToolMode(toolMode));
  }

  getToolMode() {
    let result: ToolMode;
    this.asObservable().first().subscribe(toolMode => (result = toolMode));
    return result;
  }

  asObservable() {
    return this.store.select(getToolMode);
  }
}

import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { State, Store } from 'app/store';
import { SetFillColor, SetStrokeColor, SetToolMode } from 'app/store/toolmode/actions';
import { getFillColor, getStrokeColor, getToolMode } from 'app/store/toolmode/selectors';
import { OutputSelector } from 'reselect';

/**
 * A simple service that provides an interface for making paper.js changes.
 */
@Injectable()
export class PaperService {
  constructor(private readonly store: Store<State>) {}

  setToolMode(toolMode: ToolMode) {
    if (this.getToolMode() !== toolMode) {
      this.store.dispatch(new SetToolMode(toolMode));
    }
  }

  getToolMode() {
    return this.queryStore(getToolMode);
  }

  getToolModeObservable() {
    return this.store.select(getToolMode);
  }

  getFillColorObservable() {
    return this.store.select(getFillColor);
  }

  getStrokeColorObservable() {
    return this.store.select(getStrokeColor);
  }

  getFillColor() {
    return this.queryStore(getFillColor);
  }

  setFillColor(fillColor: string) {
    if (this.getFillColor() !== fillColor) {
      this.store.dispatch(new SetFillColor(fillColor));
    }
  }

  getStrokeColor() {
    return this.queryStore(getStrokeColor);
  }

  setStrokeColor(strokeColor: string) {
    if (this.getStrokeColor() !== strokeColor) {
      this.store.dispatch(new SetStrokeColor(strokeColor));
    }
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .first()
      .subscribe(o => (obj = o));
    return obj;
  }
}

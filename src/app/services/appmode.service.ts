import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * A simple service that broadcasts changes to the current app mode.
 */
@Injectable()
export class AppModeService {
  private readonly source = new BehaviorSubject<AppMode>(AppMode.SelectPoints);

  setAppMode(appMode: AppMode) {
    if (this.getAppMode() !== appMode) {
      this.source.next(appMode);
    }
  }

  getAppMode() {
    return this.source.getValue();
  }

  asObservable() {
    return this.source.asObservable();
  }

  reset() {
    this.setAppMode(AppMode.SelectPoints);
  }
}

export enum AppMode {
  SelectPoints = 1,
  AddPoints,
  PairSubPaths,
  SplitSubPaths,
}

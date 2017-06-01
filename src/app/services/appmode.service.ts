import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * @deprecated
 */
export enum AppMode {
  Selection = 1,
  SplitCommands,
  SplitSubPaths,
  MorphSubPaths,
}

/**
 * A simple service that broadcasts changes to the current app mode.
 * @deprecated
 */
@Injectable()
export class AppModeService {
  private readonly source = new BehaviorSubject<AppMode>(AppMode.Selection);

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
    this.setAppMode(AppMode.Selection);
  }

  isSelectionMode() {
    return this.getAppMode() === AppMode.Selection;
  }
}

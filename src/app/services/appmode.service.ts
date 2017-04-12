import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * A simple service that broadcasts changes to the current app mode.
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
}

export enum AppMode {
  Selection = 1,
  SplitCommands,
  SplitSubPaths,
}

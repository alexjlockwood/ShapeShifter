import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { SelectionStateService } from './selectionstate.service';
import { HoverStateService } from './hoverstate.service';

/**
 * A simple service that broadcasts changes to the current app mode.
 */
@Injectable()
export class AppModeService {
  private readonly source = new BehaviorSubject<AppMode>(AppMode.SelectPoints);

  constructor(
    private readonly selectionStateService: SelectionStateService,
    private readonly hoverStateService: HoverStateService,
  ) { }

  setAppMode(appMode: AppMode) {
    if (this.getAppMode() !== appMode) {
      this.selectionStateService.reset();
      this.hoverStateService.reset();
      this.source.next(appMode);
    }
  }

  getAppMode() {
    return this.source.getValue();
  }

  observe() {
    return this.source.asObservable();
  }

  reset() {
    this.setAppMode(AppMode.SelectPoints);
  }
}

export enum AppMode {
  SelectPoints,
  AddPoints,
  PairSubPaths,
  SplitSubPaths,
}

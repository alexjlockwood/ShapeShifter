import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

// Note that importing these from '.' causes runtime errors.
import { SelectionService } from './selection.service';
import { HoverService } from './hover.service';

/**
 * A simple service that broadcasts changes to the current app mode.
 */
@Injectable()
export class AppModeService {
  private readonly source = new BehaviorSubject<AppMode>(AppMode.SelectPoints);

  constructor(
    private readonly selectionService: SelectionService,
    private readonly hoverService: HoverService,
  ) { }

  setAppMode(appMode: AppMode) {
    if (this.getAppMode() !== appMode) {
      this.selectionService.reset();
      this.hoverService.reset();
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
  SelectPoints,
  AddPoints,
  PairSubPaths,
  SplitSubPaths,
}

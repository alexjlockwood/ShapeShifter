import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { SelectionStateService } from './selectionstate.service';
import { HoverStateService } from './hoverstate.service';

/**
 * A simple service that broadcasts changes to the current canvas mode.
 */
@Injectable()
export class CanvasModeService {
  private readonly source = new BehaviorSubject<CanvasMode>(CanvasMode.SelectPoints);

  constructor(
    private readonly selectionStateService: SelectionStateService,
    private readonly hoverStateService: HoverStateService,
  ) { }

  setCanvasMode(canvasMode: CanvasMode) {
    if (this.getCanvasMode() !== canvasMode) {
      this.selectionStateService.reset();
      this.hoverStateService.reset();
      this.source.next(canvasMode);
    }
  }

  getCanvasMode() {
    return this.source.getValue();
  }

  getCanvasModeObservable() {
    return this.source.asObservable();
  }

  reset() {
    this.setCanvasMode(CanvasMode.SelectPoints);
  }
}

export enum CanvasMode {
  SelectPoints,
  AddPoints,
  PairSubPaths,
  SplitSubPaths,
}

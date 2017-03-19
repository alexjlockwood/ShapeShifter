import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * A simple service that broadcasts changes to the current canvas mode.
 */
@Injectable()
export class CanvasModeService {
  private readonly source = new BehaviorSubject<CanvasMode>(CanvasMode.SelectPoints);

  setCanvasMode(canvasMode: CanvasMode) {
    if (this.getCanvasMode() !== canvasMode) {
      this.source.next(canvasMode);
    }
  }

  getCanvasMode() {
    return this.source.getValue();
  }

  getCanvasModeObservable() {
    return this.source.asObservable();
  }
}

export enum CanvasMode {
  SelectPoints,
  AddPoints,
  PairSubPaths,
  SplitSubPaths,
}

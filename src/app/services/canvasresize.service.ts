import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * A simple service that broadcasts changes in the canvas' size.
 */
@Injectable()
export class CanvasResizeService {
  private readonly source = new BehaviorSubject<Size>({ width: 0, height: 0 });

  getCanvasResizeObservable() {
    return this.source.asObservable();
  }

  setSize(width: number, height: number) {
    this.source.next({ width, height });
  }
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

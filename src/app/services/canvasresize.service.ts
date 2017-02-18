import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { Index as CommandIndex } from '../scripts/commands';
import { CanvasType } from '../CanvasType';

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

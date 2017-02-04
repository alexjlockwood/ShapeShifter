import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { Index as CommandIndex } from '../scripts/commands';
import { EditorType } from '../EditorType';

@Injectable()
export class CanvasResizeService {
  readonly source = new BehaviorSubject<Size>({ width: 0, height: 0 });
  readonly stream = this.source.asObservable();

  constructor() { }

  addListener(callback: (size: Size) => void) {
    return this.stream.subscribe(callback);
  }

  setSize(width: number, height: number) {
    this.source.next({ width, height });
  }
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

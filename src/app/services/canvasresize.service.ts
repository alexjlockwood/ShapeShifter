import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType, Id as CommandId } from '../scripts/model';

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

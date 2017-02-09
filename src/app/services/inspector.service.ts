import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../CanvasType';

/**
 * This service broadcasts and helps centralize inspector-related events.
 */
@Injectable()
export class InspectorService {
  private readonly inspectorSource = new Subject<InspectorEvent>();
  private readonly inspectorStream = this.inspectorSource.asObservable();

  addListener(callback: (event: InspectorEvent) => void) {
    return this.inspectorStream.subscribe(callback);
  }

  notifyChange(event: InspectorEvent) {
    this.inspectorSource.next(event);
  }
}

export enum EventType {
  AutoFix,
  Convert,
  Reverse,
  ShiftForward,
  ShiftBack,
  Split,
  Unsplit,
};

export interface InspectorEvent {
  eventType: EventType;
  source: CanvasType;
  subIdx: number;
  cmdIdx?: number;
}

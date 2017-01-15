import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

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
  Reverse,
  ShiftForward,
  ShiftBack,
  Edit,
  Delete,
};

export interface InspectorEvent {
  eventType: EventType;
  pathCommandIndex?: number;
  subPathCommandIndex?: number;
  drawCommandIndex?: number;
}

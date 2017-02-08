import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

/**
 * This service broadcasts and listens for changes on behalf of each inspector
 * instance. Inspector components get there own instance and share it with their
 * inspector child components.
 */
@Injectable()
export class InspectorService {
  private readonly inspectorSource = new Subject<InspectorEvent>();
  private readonly inspectorStream = this.inspectorSource.asObservable();

  addListener(callback: (event: InspectorEvent) => void) {
    return this.inspectorStream.subscribe(callback);
  }

  notifyChange(eventType: EventType, args: InspectorArgs) {
    this.inspectorSource.next({
      eventType: eventType,
      subIdx: args.subIdx,
      cmdIdx: args.cmdIdx,
    });
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

export interface InspectorArgs {
  subIdx: number;
  cmdIdx?: number;
}

export interface InspectorEvent extends InspectorArgs {
  eventType: EventType;
}

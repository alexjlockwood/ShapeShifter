import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { Index as CommandIndex } from '../scripts/commands';
import { EditorType } from '../EditorType';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverStateService {
  private readonly source = new Subject<Hover>();
  readonly stream = this.source.asObservable();
  private currentHover: Hover;

  getHover() {
    return this.currentHover;
  }

  setHover(hover: Hover) {
    this.currentHover = hover;
    this.source.next(this.currentHover);
  }

  clearHover() {
    if (this.currentHover) {
      this.setHover(undefined);
    }
  }
}

/**
 * A hover represents a transient action that results as a result of a mouse hover.
 */
export interface Hover {
  readonly type: Type;
  readonly commandId?: CommandIndex;
  readonly source?: EditorType;
}

/**
 * Describes the different types of hover events.
 */
export enum Type {
  // The user hovered over a command in the inspector/canvas.
  Command,
  // The user hovered over the split button in the command inspector.
  Split,
  // The user hovered over the unsplit button in the command inspector.
  Unsplit,
}

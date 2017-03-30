import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Index as CommandIndex } from '../scripts/paths';
import { CanvasType } from '../CanvasType';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverStateService {
  private readonly source = new BehaviorSubject<Hover>(undefined);

  getHoverObservable() {
    return this.source.asObservable();
  }

  getHover() {
    return this.source.getValue();
  }

  setHover(hover: Hover) {
    this.source.next(hover);
  }

  reset() {
    if (this.source.getValue()) {
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
  readonly source?: CanvasType;
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
  // The user hovered over reverse in the command inspector.
  Reverse,
  // The user hovered over shift back in the command inspector.
  ShiftBack,
  // The user hovered over shift forward in the command inspector.
  ShiftForward,
}

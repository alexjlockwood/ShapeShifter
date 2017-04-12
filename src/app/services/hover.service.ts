import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasType } from '../CanvasType';

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverService {
  private readonly source = new BehaviorSubject<Hover>(undefined);

  asObservable() {
    return this.source.asObservable();
  }

  getHover() {
    return this.source.getValue();
  }

  setHover(hover: Hover) {
    this.source.next(hover);
  }

  setPoint(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Point, source, subIdx, cmdIdx });
  }

  setSegment(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHover({ type: HoverType.Segment, source, subIdx, cmdIdx });
  }

  setSubPath(source: CanvasType, subIdx: number) {
    this.setHover({ type: HoverType.SubPath, source, subIdx });
  }

  reset() {
    if (this.source.getValue()) {
      this.setHover(undefined);
    }
  }
}

/**
 * A hover represents a transient action that results from a mouse movement.
 */
export interface Hover {
  readonly type: HoverType;
  readonly source: CanvasType;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of hover events.
 */
export enum HoverType {
  // The user hovered over a subpath in the inspector/canvas.
  SubPath = 1,
  // The user hovered over a segment in the inspector/canvas
  Segment,
  // The user hovered over a point in the inspector/canvas.
  Point,
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

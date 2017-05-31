import { CanvasType } from '../CanvasType';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

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
  // The user hovered over the shift to first position button in the toolbar.
  SetFirstPosition,
}

/**
 * A simple service that broadcasts hover events to all parts of the application.
 */
@Injectable()
export class HoverService {
  private readonly source = new BehaviorSubject<Hover>(undefined);
  private hover: Hover;

  asObservable() {
    return this.source.asObservable();
  }

  getHover() {
    return this.hover;
  }

  setHover(hover: Hover) {
    this.hover = hover;
  }

  setHoverAndNotify(hover: Hover) {
    this.setHover(hover);
    this.notify();
  }

  setPoint(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHoverAndNotify({ type: HoverType.Point, source, subIdx, cmdIdx });
  }

  setSegment(source: CanvasType, subIdx: number, cmdIdx: number) {
    this.setHoverAndNotify({ type: HoverType.Segment, source, subIdx, cmdIdx });
  }

  setSubPath(source: CanvasType, subIdx: number) {
    this.setHoverAndNotify({ type: HoverType.SubPath, source, subIdx });
  }

  reset() {
    this.setHover(undefined);
  }

  resetAndNotify() {
    this.setHoverAndNotify(undefined);
  }

  notify() {
    this.source.next(this.hover);
  }
}

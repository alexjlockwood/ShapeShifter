import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath, HitResult } from '../scripts/paths';
import { Point, MathUtil } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  SelectionService, SelectionType,
  HoverService, HoverType,
} from '../services';

/**
 * Helper class that can be used to split a subpath.
 */
export class SubPathSplitter {
  private currentProjectionOntoPath: ProjectionOntoPath;
  private firstSplitProjectionOntoPath: ProjectionOntoPath;
  private lastKnownMouseLocation: Point;

  constructor(
    private readonly component: CanvasComponent,
    private readonly mouseDown: Point,
  ) { }

  onMouseDown(mouseDown) {
    this.findProjection(mouseDown);
  }

  onMouseMove(mouseMove: Point) {
    this.findProjection(mouseMove);
  }

  private findProjection(mousePoint: Point) {
    let restrictToSubIdx: number = undefined;
    if (this.firstSplitProjectionOntoPath) {
      restrictToSubIdx = this.firstSplitProjectionOntoPath.subIdx;
    }
    this.currentProjectionOntoPath =
      this.component.calculateProjectionOntoPath(mousePoint, restrictToSubIdx);
  }

  getFirstSplitProjectionOntoPath() {
    return this.firstSplitProjectionOntoPath;
  }

  getCurrentProjectionOntoPath() {
    return this.currentProjectionOntoPath;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }
}

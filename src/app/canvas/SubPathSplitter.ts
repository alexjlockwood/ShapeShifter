import * as _ from 'lodash';
import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath, HitResult } from '../scripts/paths';
import { Point } from '../scripts/common';
import { AppModeService, AppMode, } from '../services';

/**
 * Helper class that can be used to split a filled subpath.
 */
export class ShapeSplitter {
  private readonly appModeService: AppModeService;
  private initialProjectionOntoPath: ProjectionOntoPath;
  private doesInitialPointExist = false;
  private currentProjectionOntoPath: ProjectionOntoPath;
  private finalProjectionOntoPath: ProjectionOntoPath;
  private doesFinalPointExist = false;
  private hitResult: HitResult;
  private lastKnownMouseLocation: Point;

  constructor(
    private readonly component: CanvasComponent,
    private readonly restrictToSubIdx?: number,
  ) {
    this.appModeService = component.appModeService;
  }

  onMouseDown(mouseDown: Point) {
    this.onMouseEvent(mouseDown);

    if (this.hitResult.isEndPointHit) {
      const projectionOntoPath = _.last(this.hitResult.endPointHits);
      this.initialProjectionOntoPath = projectionOntoPath;
      this.doesInitialPointExist = true;
      this.component.showPenCursor();
      this.component.drawOverlays();
      return;
    }
    if (this.currentProjectionOntoPath) {
      const projection = this.currentProjectionOntoPath.projection;
      if (projection.d < this.component.minSnapThreshold) {
        this.initialProjectionOntoPath = this.currentProjectionOntoPath;
        this.component.showPenCursor();
        this.component.drawOverlays();
        return;
      }
    }
    if (this.hitResult.isShapeHit) {
      if (this.restrictToSubIdx !== undefined) {
        const subIdxs = this.hitResult.shapeHits.map(proj => {
          return proj.subIdx;
        });
        if (subIdxs.indexOf(this.restrictToSubIdx) >= 0) {
          this.component.drawOverlays();
          return;
        }
      }
    }
    this.reset();
    this.appModeService.setAppMode(AppMode.SelectPoints);
  }

  onMouseMove(mouseMove: Point) {
    this.onMouseEvent(mouseMove);
    if (!this.initialProjectionOntoPath) {
      this.component.drawOverlays();
      return;
    }

    if (this.hitResult.isEndPointHit) {
      this.finalProjectionOntoPath = this.currentProjectionOntoPath;
      this.doesFinalPointExist = true;
    } else if (this.currentProjectionOntoPath) {
      const projection = this.currentProjectionOntoPath.projection;
      if (projection.d < this.component.minSnapThreshold) {
        this.finalProjectionOntoPath = this.currentProjectionOntoPath;
      } else {
        this.finalProjectionOntoPath = undefined;
      }
      this.doesFinalPointExist = false;
    } else {
      this.doesFinalPointExist = false;
      this.finalProjectionOntoPath = undefined;
    }
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point) {
    if (!this.initialProjectionOntoPath) {
      return;
    }
    this.onMouseEvent(mouseUp);
    if (this.currentProjectionOntoPath) {
      const projection = this.currentProjectionOntoPath.projection;
      if (projection.d < this.component.minSnapThreshold) {
        this.finalProjectionOntoPath = this.currentProjectionOntoPath;
      }
    }
    if (this.finalProjectionOntoPath
      && this.initialProjectionOntoPath.subIdx === this.finalProjectionOntoPath.subIdx
      && this.initialProjectionOntoPath.cmdIdx !== this.finalProjectionOntoPath.cmdIdx) {
      if (this.initialProjectionOntoPath.subIdx > this.finalProjectionOntoPath.subIdx
        || this.initialProjectionOntoPath.cmdIdx > this.finalProjectionOntoPath.cmdIdx) {
        const t1 = this.initialProjectionOntoPath;
        this.initialProjectionOntoPath = this.finalProjectionOntoPath;
        this.finalProjectionOntoPath = t1;
        const t2 = this.doesInitialPointExist;
        this.doesFinalPointExist = this.doesInitialPointExist;
        this.doesFinalPointExist = t2;
      }
      const activeLayer = this.component.activePathLayer;
      const pathMutator = activeLayer.pathData.mutate();
      if (!this.doesInitialPointExist) {
        pathMutator.splitCommand(
          this.initialProjectionOntoPath.subIdx,
          this.initialProjectionOntoPath.cmdIdx,
          this.initialProjectionOntoPath.projection.t);
      }
      let offset = 0;
      if (!this.doesFinalPointExist) {
        if (!this.doesInitialPointExist) {
          offset++;
        }
        pathMutator.splitCommand(
          this.finalProjectionOntoPath.subIdx,
          this.finalProjectionOntoPath.cmdIdx + offset,
          this.finalProjectionOntoPath.projection.t);
      }
      const subIdx = this.initialProjectionOntoPath.subIdx;
      const startingCmdIdx = this.initialProjectionOntoPath.cmdIdx;
      const endingCmdIdx = this.finalProjectionOntoPath.cmdIdx + offset;
      this.component.stateService.updateActivePath(
        this.component.canvasType,
        pathMutator
          .splitFilledSubPath(subIdx, startingCmdIdx, endingCmdIdx)
          .build());
    }
    this.reset();
    this.component.drawOverlays();
  }

  onMouseLeave(mouseMove: Point) {
    if (!this.initialProjectionOntoPath) {
      return;
    }
    this.onMouseEvent(mouseMove);
    this.reset();
    this.component.drawOverlays();
  }

  private onMouseEvent(mousePoint: Point) {
    this.lastKnownMouseLocation = mousePoint;
    let restrictToSubIdx: number;
    if (this.restrictToSubIdx !== undefined) {
      restrictToSubIdx = this.restrictToSubIdx;
    } else if (this.initialProjectionOntoPath) {
      restrictToSubIdx = this.initialProjectionOntoPath.subIdx;
    }
    this.currentProjectionOntoPath =
      this.component.calculateProjectionOntoPath(
        mousePoint, restrictToSubIdx);
    this.hitResult = this.performHitTest(mousePoint, restrictToSubIdx);
  }

  private performHitTest(mousePoint: Point, restrictToSubIdx: number) {
    const noSegments = !this.component.activePathLayer.isStroked();
    return this.component.performHitTest(mousePoint, { noSegments, restrictToSubIdx });
  }

  reset() {
    this.initialProjectionOntoPath = undefined;
    this.currentProjectionOntoPath = undefined;
    this.finalProjectionOntoPath = undefined;
    this.doesInitialPointExist = false;
    this.doesFinalPointExist = false;
    this.hitResult = undefined;
    this.lastKnownMouseLocation = undefined;
    this.component.resetCursor();
  }

  getInitialProjectionOntoPath() {
    return this.initialProjectionOntoPath;
  }

  getFinalProjectionOntoPath() {
    return this.finalProjectionOntoPath;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }

  getCurrentProjectionOntoPath() {
    return this.currentProjectionOntoPath;
  }
}

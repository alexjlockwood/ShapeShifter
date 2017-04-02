import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath } from '../scripts/paths';
import { Point } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  AppModeService, AppMode,
} from '../services';

/**
 * Helper class that can be used to split a segment.
 */
export class SegmentSplitter {
  private readonly stateService: StateService;
  private readonly appModeService: AppModeService;
  private readonly canvasType: CanvasType;
  private projectionOntoPath: ProjectionOntoPath;
  private lastKnownMouseLocation: Point;

  constructor(
    private readonly component: CanvasComponent,
    private readonly restrictToSubIdx?: number,
  ) {
    this.stateService = component.stateService;
    this.appModeService = component.appModeService;
    this.canvasType = component.canvasType;
  }

  onMouseDown(mouseDown: Point) {
    this.onMouseEvent(mouseDown);
    const activePathLayer = this.component.activePathLayer;
    if (this.projectionOntoPath) {
      const projection = this.projectionOntoPath.projection;
      if (projection.d < this.component.minSnapThreshold) {
        // We're in range, so split the segment!
        const { subIdx, cmdIdx } = this.projectionOntoPath;
        if (this.appModeService.getAppMode() === AppMode.AddPoints) {
          const pathMutator =
            activePathLayer.pathData.mutate()
              .splitCommand(subIdx, cmdIdx, projection.t);
          if (this.appModeService.getAppMode() === AppMode.SplitSubPaths
            && this.component.activePathLayer.isStroked()) {
            pathMutator.splitStrokedSubPath(subIdx, cmdIdx);
          }
          this.component.stateService.updateActivePath(
            this.canvasType, pathMutator.build());
        }
        return;
      }
    }
    if (!activePathLayer.isStroked()) {
      const restrictToSubIdx = this.restrictToSubIdx;
      const hitResult =
        this.component.performHitTest(
          mouseDown,
          { noPoints: true, noSegments: true, restrictToSubIdx });
      if (hitResult.isHit) {
        return;
      }
    }
    this.appModeService.setAppMode(AppMode.SelectPoints);
  }

  onMouseMove(mouseMove: Point) {
    this.onMouseEvent(mouseMove);
  }

  onMouseUp(mouseUp: Point) {
    this.onMouseEvent(mouseUp);
  }

  onMouseLeave(mouseLeave) {
    this.projectionOntoPath = undefined;
    this.component.drawOverlays();
  }

  private onMouseEvent(mousePoint: Point) {
    this.lastKnownMouseLocation = mousePoint;
    this.projectionOntoPath =
      this.component.calculateProjectionOntoPath(
        mousePoint, this.restrictToSubIdx);
    this.component.drawOverlays();
  }

  getSelectedSubIdx() {
    return this.restrictToSubIdx;
  }

  getProjectionOntoPath() {
    return this.projectionOntoPath;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }
}

import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath } from '../scripts/paths';
import { Point } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService, AppModeService, AppMode,
  HoverService,
  SelectionService,
} from '../services';

/**
 * Helper class that can be used to split a segment.
 */
export class SegmentSplitter {
  private readonly stateService: StateService;
  private readonly selectionService: SelectionService;
  private readonly hoverService: HoverService;
  private readonly appModeService: AppModeService;
  private readonly canvasType: CanvasType;
  private currProjInfo: ProjInfo;
  private lastKnownMouseLocation: Point;

  constructor(
    private readonly component: CanvasComponent,
    private readonly restrictToSubIdx?: number,
  ) {
    this.stateService = component.stateService;
    this.hoverService = component.hoverService;
    this.selectionService = component.selectionService;
    this.appModeService = component.appModeService;
    this.canvasType = component.canvasType;
  }

  onMouseDown(mouseDown: Point) {
    this.lastKnownMouseLocation = mouseDown;
    this.currProjInfo = this.findProjInfo(mouseDown);
    const activePathLayer = this.component.activePathLayer;
    if (this.currProjInfo) {
      const { proj: { subIdx, cmdIdx, projection }, isEndPt } = this.currProjInfo;
      const appMode = this.appModeService.getAppMode();
      const pathMutator = activePathLayer.pathData.mutate();
      if (appMode === AppMode.SplitCommands) {
        pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
      } else if (appMode === AppMode.SplitSubPaths) {
        if (!isEndPt) {
          pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
        }
        pathMutator.splitStrokedSubPath(subIdx, cmdIdx);
      }

      // TODO: make sure the inspector doesn't set hovers/selections while a split is in process...
      this.hoverService.reset();
      this.selectionService.reset();
      this.currProjInfo = undefined;

      this.component.stateService.updateActivePath(
        this.canvasType, pathMutator.build());
      this.component.drawOverlays();
      return;
    }

    this.appModeService.setAppMode(AppMode.Selection);
    this.component.drawOverlays();
  }

  onMouseMove(mouseMove: Point) {
    this.lastKnownMouseLocation = mouseMove;
    this.currProjInfo = this.findProjInfo(mouseMove);
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point) {
    this.lastKnownMouseLocation = mouseUp;
    this.component.drawOverlays();
  }

  onMouseLeave(mouseLeave) {
    this.lastKnownMouseLocation = mouseLeave;
    this.currProjInfo = undefined;
    this.component.drawOverlays();
  }

  getProjectionOntoPath() {
    if (!this.currProjInfo) {
      return undefined;
    }
    return this.currProjInfo.proj;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }

  private findProjInfo(mousePoint: Point) {
    const projInfos: ProjInfo[] = [];
    const hitResult = this.component.performHitTest(mousePoint);
    const { isEndPointHit, isSegmentHit, endPointHits, segmentHits } = hitResult;
    if (isEndPointHit) {
      for (const proj of endPointHits) {
        projInfos.push({ proj, isEndPt: true });
      }
    }
    if (isSegmentHit) {
      for (const proj of segmentHits) {
        projInfos.push({ proj, isEndPt: false });
      }
    }
    if (!projInfos.length) {
      return undefined;
    }
    projInfos.sort((p1, p2) => {
      const { proj: proj1, isEndPt: isEndPt1 } = p1;
      const { proj: proj2, isEndPt: isEndPt2 } = p2;
      if (isEndPt1 !== isEndPt2) {
        return isEndPt1 ? -1 : 1;
      }
      if (proj1.projection.d !== proj2.projection.d) {
        return proj1.projection.d - proj2.projection.d;
      }
      if (proj1.subIdx !== proj2.subIdx) {
        return proj1.subIdx - proj2.subIdx;
      }
      if (proj1.cmdIdx !== proj2.cmdIdx) {
        return proj1.cmdIdx - proj2.cmdIdx;
      }
      return 0;
    });
    return projInfos[0];
  };
}

interface ProjInfo {
  readonly proj: ProjectionOntoPath;
  readonly isEndPt: boolean;
}

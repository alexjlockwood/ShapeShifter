import { CanvasType } from '../CanvasType';
import { Point } from '../scripts/common';
import { ProjectionOntoPath } from '../scripts/paths';
import {
  SetPathHover,
  SetPathSelections,
  SetShapeShifterMode,
  ShapeShifterMode,
  State,
  Store,
  UpdateActivePathBlock,
} from '../store';
import { CanvasOverlayDirective } from './canvasoverlay.directive';

interface ProjInfo {
  readonly proj: ProjectionOntoPath;
  readonly isEndPt: boolean;
}

/**
 * Helper class that can be used to split a segment.
 */
export class SegmentSplitter {
  private readonly canvasType: CanvasType;
  private readonly store: Store<State>;
  private currProjInfo: ProjInfo;
  private lastKnownMouseLocation: Point;

  constructor(
    private readonly component: CanvasOverlayDirective,
    readonly restrictToSubIdx?: number,
  ) {
    this.canvasType = component.canvasType;
    this.store = component.store;
  }

  onMouseDown(mouseDown: Point) {
    this.lastKnownMouseLocation = mouseDown;
    this.currProjInfo = this.findProjInfo(mouseDown);
    const activePathLayer = this.component.activePathLayer;
    if (this.currProjInfo) {
      const { proj: { subIdx, cmdIdx, projection }, isEndPt } = this.currProjInfo;
      const mode = this.component.shapeShifterMode;
      const pathMutator = activePathLayer.pathData.mutate();
      if (mode === ShapeShifterMode.SplitCommands) {
        pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
      } else if (mode === ShapeShifterMode.SplitSubPaths) {
        if (!isEndPt) {
          pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
        }
        pathMutator.splitStrokedSubPath(subIdx, cmdIdx);
      }

      // TODO: make sure the inspector doesn't set hovers/selections while a split is in process...
      this.store.dispatch(new SetPathHover(undefined));
      this.store.dispatch(new SetPathSelections([]));
      this.currProjInfo = undefined;
      this.store.dispatch(
        new UpdateActivePathBlock(
          this.canvasType,
          pathMutator.build(),
        ));
      this.component.draw();
      return;
    }

    this.store.dispatch(new SetShapeShifterMode(ShapeShifterMode.Selection));
    this.component.draw();
  }

  onMouseMove(mouseMove: Point) {
    this.lastKnownMouseLocation = mouseMove;
    this.currProjInfo = this.findProjInfo(mouseMove);
    this.component.draw();
  }

  onMouseUp(mouseUp: Point) {
    this.lastKnownMouseLocation = mouseUp;
    this.component.draw();
  }

  onMouseLeave(mouseLeave) {
    this.lastKnownMouseLocation = mouseLeave;
    this.currProjInfo = undefined;
    this.component.draw();
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

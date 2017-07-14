import { ActionMode, ActionSource } from 'app/model/actionmode';
import { ProjectionOntoPath } from 'app/model/paths';
import { Point } from 'app/scripts/common';
import { ActionModeService } from 'app/services';
import { State, Store } from 'app/store';

import { CanvasOverlayDirective } from './canvasoverlay.directive';

interface ProjInfo {
  readonly proj: ProjectionOntoPath;
  readonly isEndPt: boolean;
}

// TODO: prefer previous selections over others when performing splits?
// TODO: clean up this class' messy communication w/ the overlay directive

/**
 * Helper class that can be used to split a segment.
 */
export class SegmentSplitter {
  private readonly actionSource: ActionSource;
  private readonly store: Store<State>;
  private readonly actionModeService: ActionModeService;
  private currProjInfo: ProjInfo;
  private lastKnownMouseLocation: Point;

  constructor(private readonly component: CanvasOverlayDirective) {
    this.actionSource = component.actionSource;
    this.store = component.store;
    this.actionModeService = component.actionModeService;
  }

  onMouseDown(mouseDown: Point) {
    this.lastKnownMouseLocation = mouseDown;
    this.currProjInfo = this.findProjInfo(mouseDown);
    const activePathLayer = this.component.activePathLayer;
    if (this.currProjInfo) {
      const { proj: { subIdx, cmdIdx, projection }, isEndPt } = this.currProjInfo;
      const mode = this.component.actionMode;
      const pathMutator = activePathLayer.pathData.mutate();
      if (mode === ActionMode.SplitCommands) {
        pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
      } else if (mode === ActionMode.SplitSubPaths) {
        if (!isEndPt) {
          pathMutator.splitCommand(subIdx, cmdIdx, projection.t);
        }
        pathMutator.splitStrokedSubPath(subIdx, cmdIdx);
      }

      this.component.actionModeService.clearHover();
      this.actionModeService.setSelections([]);
      this.currProjInfo = undefined;
      this.actionModeService.updateActivePathBlock(this.actionSource, pathMutator.build());
      this.component.draw();
      return;
    }

    this.actionModeService.setActionMode(ActionMode.Selection);
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

  onMouseLeave(mouseLeave: Point) {
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
    const hitResult = this.component.performHitTest(mousePoint, { withExtraSegmentPadding: true });
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
  }
}

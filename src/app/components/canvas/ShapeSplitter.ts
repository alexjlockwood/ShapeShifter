import { ActionMode } from 'app/model/actionmode';
import { HitResult, ProjectionOntoPath } from 'app/model/paths';
import { Point } from 'app/scripts/common';
import { ActionModeService } from 'app/services';
import { State, Store } from 'app/store';
import * as _ from 'lodash';

import { CanvasOverlayDirective } from './canvasoverlay.directive';

interface ProjInfo {
  readonly proj: ProjectionOntoPath;
  readonly isEndPt: boolean;
}

// TODO: prefer previous selections over others when performing splits?
// TODO: clean up this class' messy communication w/ the overlay directive

/**
 * Helper class that can be used to split a filled subpath.
 */
export class ShapeSplitter {
  private readonly store: Store<State>;
  private readonly actionModeService: ActionModeService;
  private initProjInfos: ProjInfo[] = [];
  private currProjInfos: ProjInfo[] = [];
  private finalProjInfos: ProjInfo[] = [];
  private hitResult: HitResult;
  private lastKnownMouseLocation: Point;

  constructor(private readonly component: CanvasOverlayDirective) {
    this.store = component.store;
    this.actionModeService = component.actionModeService;
  }

  onMouseDown(mouseDown: Point) {
    this.initProjInfos = [];
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseDown;
    this.hitResult = this.performHitTest(mouseDown);
    const { isEndPointHit, isSegmentHit, endPointHits, segmentHits } = this.hitResult;
    if (isEndPointHit || isSegmentHit) {
      for (const proj of endPointHits) {
        this.initProjInfos.push({ proj, isEndPt: true });
      }
      for (const proj of segmentHits) {
        this.initProjInfos.push({ proj, isEndPt: false });
      }
      this.component.draw();
      return;
    }
    this.actionModeService.setActionMode(ActionMode.Selection);
  }

  onMouseMove(mouseMove: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseMove;
    this.hitResult = this.performHitTest(mouseMove);
    if (!this.initProjInfos.length) {
      this.component.draw();
      return;
    }
    this.populateFinalProjInfos(mouseMove);
    this.component.draw();
  }

  onMouseUp(mouseUp: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseUp;
    if (!this.initProjInfos.length) {
      this.reset();
      this.component.draw();
      return;
    }
    this.populateFinalProjInfos(mouseUp);

    const sortProjInfosFn = (projInfos: ProjInfo[]) => {
      projInfos.sort((p1, p2) => {
        const { proj: proj1, isEndPt: isEndPt1 } = p1;
        const { proj: proj2, isEndPt: isEndPt2 } = p2;
        if (isEndPt1 !== isEndPt2) {
          // Prefer snapping to existing end points first...
          return isEndPt1 ? -1 : 1;
        }
        if (proj1.projection.d !== proj2.projection.d) {
          // Then take into account the distance to the new point...
          return proj1.projection.d - proj2.projection.d;
        }
        if (proj1.subIdx !== proj2.subIdx) {
          // Then prefer sub paths with higher z-orders...
          return proj1.subIdx - proj2.subIdx;
        }
        if (proj1.cmdIdx !== proj2.cmdIdx) {
          // And then finally commands with higher z-orders.
          return proj1.cmdIdx - proj2.cmdIdx;
        }
        return 0;
      });
    };

    sortProjInfosFn(this.initProjInfos);
    sortProjInfosFn(this.finalProjInfos);

    let initProjInfo: ProjInfo;
    let finalProjInfo: ProjInfo;
    for (const p1 of this.initProjInfos) {
      for (const p2 of this.finalProjInfos) {
        const { proj: { subIdx: subIdx1, cmdIdx: cmdIdx1 } } = p1;
        const { proj: { subIdx: subIdx2, cmdIdx: cmdIdx2 } } = p2;
        if (subIdx1 === subIdx2) {
          if (cmdIdx1 === cmdIdx2) {
            continue;
          }
          initProjInfo = p1;
          finalProjInfo = p2;
          break;
        }
      }
      if (initProjInfo && finalProjInfo) {
        break;
      }
    }

    if (initProjInfo && finalProjInfo) {
      const activeLayer = this.component.activePathLayer;
      const pathMutator = activeLayer.pathData.mutate();
      const {
        proj: { subIdx: initSubIdx, cmdIdx: initCmdIdx },
        isEndPt: isInitEndPt,
      } = initProjInfo;
      const {
        proj: { subIdx: finalSubIdx, cmdIdx: finalCmdIdx },
        isEndPt: isFinalEndPt,
      } = finalProjInfo;
      let lastCmdOffset = 0;
      if (!isInitEndPt || !isFinalEndPt) {
        if (initCmdIdx > finalCmdIdx) {
          if (!isInitEndPt) {
            pathMutator.splitCommand(initSubIdx, initCmdIdx, initProjInfo.proj.projection.t);
            if (!isFinalEndPt) {
              lastCmdOffset++;
            }
          }
          if (!isFinalEndPt) {
            pathMutator.splitCommand(finalSubIdx, finalCmdIdx, finalProjInfo.proj.projection.t);
            if (isInitEndPt) {
              lastCmdOffset++;
            }
          }
        } else {
          if (!isFinalEndPt) {
            pathMutator.splitCommand(finalSubIdx, finalCmdIdx, finalProjInfo.proj.projection.t);
            if (!isInitEndPt) {
              lastCmdOffset++;
            }
          }
          if (!isInitEndPt) {
            pathMutator.splitCommand(initSubIdx, initCmdIdx, initProjInfo.proj.projection.t);
            if (isFinalEndPt) {
              lastCmdOffset++;
            }
          }
        }
      }

      this.component.actionModeService.clearHover();
      this.actionModeService.setSelections([]);
      this.reset();

      // TODO: some bugs with this path: M 0 20 v -16 h 20 v 2 h -12 v 2 h 12 v 2 h -12 Z
      // TODO: how should we deal with collinear intersections? (i.e. drawing a line across the same line)
      const startingCmdIdx = initCmdIdx > finalCmdIdx ? finalCmdIdx : initCmdIdx;
      const endingCmdIdx =
        initCmdIdx > finalCmdIdx ? initCmdIdx + lastCmdOffset : finalCmdIdx + lastCmdOffset;
      this.actionModeService.updateActivePathBlock(
        this.component.actionSource,
        pathMutator.splitFilledSubPath(initSubIdx, startingCmdIdx, endingCmdIdx).build(),
      );
    }
    this.reset();
    this.component.draw();
  }

  onMouseLeave(mouseLeave: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseLeave;
    this.hitResult = this.performHitTest(mouseLeave);
    if (!this.initProjInfos.length) {
      return;
    }
    this.reset();
    this.component.draw();
  }

  private populateFinalProjInfos(mousePoint: Point) {
    const { isEndPointHit, isSegmentHit, endPointHits, segmentHits } = this.hitResult;
    if (isEndPointHit || isSegmentHit) {
      for (const proj of endPointHits) {
        this.finalProjInfos.push({ proj, isEndPt: true });
      }
      for (const proj of segmentHits) {
        this.finalProjInfos.push({ proj, isEndPt: false });
      }
      const allowedSubIdxs = new Set<number>(
        this.initProjInfos.map(projInfo => projInfo.proj.subIdx),
      );
      _.remove(this.finalProjInfos, projInfo => !allowedSubIdxs.has(projInfo.proj.subIdx));
    }
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint, { withExtraSegmentPadding: true });
  }

  private reset() {
    this.initProjInfos = [];
    this.currProjInfos = [];
    this.finalProjInfos = [];
    this.hitResult = undefined;
    this.lastKnownMouseLocation = undefined;
  }

  getCurrentProjectionOntoPath() {
    if (!this.hitResult) {
      return undefined;
    }
    const { isEndPointHit, isSegmentHit, endPointHits, segmentHits } = this.hitResult;
    if (isEndPointHit) {
      return _.last(endPointHits);
    }
    if (isSegmentHit) {
      return _.last(segmentHits);
    }
    return undefined;
  }

  getInitialProjectionOntoPath() {
    if (!this.initProjInfos.length) {
      return undefined;
    }
    return this.initProjInfos[0].proj;
  }

  getFinalProjectionOntoPath() {
    if (!this.finalProjInfos.length) {
      return undefined;
    }
    return this.finalProjInfos[0].proj;
  }

  willFinalProjectionOntoPathCreateSplitPoint() {
    if (!this.finalProjInfos.length) {
      return true;
    }
    return !this.finalProjInfos[0].isEndPt;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }
}

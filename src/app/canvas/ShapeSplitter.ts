import * as _ from 'lodash';
import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath, HitResult } from '../scripts/paths';
import { Point } from '../scripts/common';
import {
  AppModeService, AppMode,
  SelectionService,
  HoverService,
} from '../services';

/**
 * Helper class that can be used to split a filled subpath.
 */
export class ShapeSplitter {
  private readonly appModeService: AppModeService;
  private readonly selectionService: SelectionService;
  private readonly hoverService: HoverService;
  private initProjInfos: ProjInfo[] = [];
  private currProjInfos: ProjInfo[] = [];
  private finalProjInfos: ProjInfo[] = [];
  private hitResult: HitResult;
  private lastKnownMouseLocation: Point;

  constructor(private readonly component: CanvasComponent) {
    this.appModeService = component.appModeService;
    this.selectionService = component.selectionService;
    this.hoverService = component.hoverService;
  }

  onMouseDown(mouseDown: Point) {
    this.initProjInfos = [];
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseDown;
    this.hitResult = this.component.performHitTest(mouseDown);
    const { isEndPointHit, isSegmentHit, endPointHits, segmentHits } = this.hitResult;
    if (isEndPointHit || isSegmentHit) {
      for (const proj of endPointHits) {
        this.initProjInfos.push({ proj, isEndPt: true });
      }
      for (const proj of segmentHits) {
        this.initProjInfos.push({ proj, isEndPt: false });
      }
      this.component.drawOverlays();
      return;
    }
    this.component.drawOverlays();
    this.appModeService.setAppMode(AppMode.Selection);
  }

  onMouseMove(mouseMove: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseMove;
    this.hitResult = this.component.performHitTest(mouseMove);
    if (!this.initProjInfos.length) {
      this.component.drawOverlays();
      return;
    }
    this.populateFinalProjInfos(mouseMove);
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseUp;
    if (!this.initProjInfos.length) {
      this.component.drawOverlays();
      return;
    }
    this.populateFinalProjInfos(mouseUp);

    const sortProjInfosFn = (projInfos: ProjInfo[]) => {
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
      const { proj: { subIdx: initSubIdx, cmdIdx: initCmdIdx }, isEndPt: isInitEndPt } = initProjInfo;
      const { proj: { subIdx: finalSubIdx, cmdIdx: finalCmdIdx }, isEndPt: isFinalEndPt } = finalProjInfo;
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

      // TODO: make sure the inspector doesn't set hovers/selections while a split is in process...
      this.hoverService.reset();
      this.selectionService.reset();
      this.reset();

      // TODO: some bugs with this path: M 0 20 v -16 h 20 v 2 h -12 v 2 h 12 v 2 h -12 Z
      // TODO: is it possible for there to be 1 or 2 intersections and be invalid?
      // TODO: how should we deal with collinear intersections? (i.e. drawing a line across the same line)
      const startingCmdIdx = initCmdIdx > finalCmdIdx ? finalCmdIdx : initCmdIdx;
      const endingCmdIdx =
        initCmdIdx > finalCmdIdx ? initCmdIdx + lastCmdOffset : finalCmdIdx + lastCmdOffset;
      this.component.stateService.updateActivePath(
        this.component.canvasType,
        pathMutator
          .splitFilledSubPath(initSubIdx, startingCmdIdx, endingCmdIdx)
          .build());
    }
    this.component.drawOverlays();
  }

  onMouseLeave(mouseLeave: Point) {
    this.finalProjInfos = [];
    this.lastKnownMouseLocation = mouseLeave;
    this.hitResult = this.component.performHitTest(mouseLeave);
    if (!this.initProjInfos.length) {
      return;
    }
    this.reset();
    this.component.drawOverlays();
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
      const allowedSubIdxs =
        new Set<number>(this.initProjInfos.map(projInfo => projInfo.proj.subIdx));
      _.remove(this.finalProjInfos, projInfo => !allowedSubIdxs.has(projInfo.proj.subIdx));
    }
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

interface ProjInfo {
  readonly proj: ProjectionOntoPath;
  readonly isEndPt: boolean;
}

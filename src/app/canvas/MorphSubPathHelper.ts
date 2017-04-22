import * as _ from 'lodash';
import { CanvasComponent } from './canvas.component';
import { Point } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  HoverService,
  HoverType,
  AppMode,
  MorphSubPathService,
} from '../services';

/**
 * Helper class that tracks information during morph subpath mode.
 */
export class MorphSubPathHelper {
  private readonly stateService: StateService;
  private readonly hoverService: HoverService;
  private readonly morphSubPathService: MorphSubPathService;
  private readonly canvasType: CanvasType;

  constructor(private readonly component: CanvasComponent) {
    this.stateService = component.stateService;
    this.hoverService = component.hoverService;
    this.morphSubPathService = component.morphSubPathService;
    this.canvasType = component.canvasType;
  }

  onMouseDown(mouseDown: Point, isShiftOrMetaPressed: boolean) {
    const hitResult = this.performHitTest(mouseDown);

    if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      let { subIdx } = this.findHitSubPath(hits);
      const currUnpair =
        this.morphSubPathService.getCurrentUnpairedSubPath();
      if (currUnpair
        && subIdx !== currUnpair.subIdx
        && this.canvasType !== currUnpair.source) {
        let { source: fromSource, subIdx: fromSubIdx } = currUnpair;
        let toSource = this.canvasType;
        let toSubIdx = subIdx;
        const numFromSubPaths =
          this.stateService.getActivePathLayer(fromSource).pathData
            .getSubPaths().filter(s => !s.isCollapsing()).length;
        if (toSubIdx >= numFromSubPaths) {
          const tempFromSource = fromSource;
          fromSource = toSource;
          toSource = tempFromSource;
          const tempFromSubIdx = fromSubIdx;
          fromSubIdx = toSubIdx;
          toSubIdx = tempFromSubIdx;
        }
        // this.hoverService.resetAndNotify();
        // this.selectionService.resetAndNotify();
        this.morphSubPathService.reset();
        this.morphSubPathService.setPairedSubPaths(new Set([toSubIdx]));
        this.stateService.updateActivePath(
          fromSource,
          this.stateService.getActivePathLayer(fromSource).pathData.mutate()
            .moveSubPath(fromSubIdx, toSubIdx)
            .build());
        subIdx = toSubIdx;
      } else {
        this.morphSubPathService.setCurrentUnpairedSubPath(this.canvasType, subIdx).notify();
      }
    } else if (!isShiftOrMetaPressed) {
      this.component.appModeService.setAppMode(AppMode.Selection);
    }
  }

  onMouseMove(mouseMove: Point) {
    this.checkForHovers(mouseMove);
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point) {
    this.component.drawOverlays();
  }

  onMouseLeave(mouseLeave: Point) {
    this.component.drawOverlays();
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint);
  }

  private checkForHovers(mousePoint: Point) {
    const hitResult = this.performHitTest(mousePoint);
    if (!hitResult.isHit) {
      this.hoverService.resetAndNotify();
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      this.hoverService.setHover({
        type: HoverType.SubPath,
        source: this.canvasType,
        subIdx,
      });
      this.component.resetCursor();
    }
  }

  private findHitSubPath(hits: ReadonlyArray<{ subIdx: number }>) {
    const infos = hits.map(index => {
      const { subIdx } = index;
      return { subIdx, subPath: this.component.activePath.getSubPath(subIdx) };
    });
    const lastSplitIndex = _.findLastIndex(infos, info => info.subPath.isSplit());
    return infos[lastSplitIndex < 0 ? infos.length - 1 : lastSplitIndex];
  }
}

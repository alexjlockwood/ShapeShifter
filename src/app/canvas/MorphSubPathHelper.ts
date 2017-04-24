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
  SelectionService,
} from '../services';

/**
 * Helper class that tracks information during morph subpath mode.
 */
export class MorphSubPathHelper {
  private readonly stateService: StateService;
  private readonly hoverService: HoverService;
  private readonly selectionService: SelectionService;
  private readonly morphSubPathService: MorphSubPathService;
  private readonly canvasType: CanvasType;

  constructor(private readonly component: CanvasComponent) {
    this.stateService = component.stateService;
    this.hoverService = component.hoverService;
    this.selectionService = component.selectionService;
    this.morphSubPathService = component.morphSubPathService;
    this.canvasType = component.canvasType;
  }

  onMouseDown(mouseDown: Point, isShiftOrMetaPressed: boolean) {
    const hitResult = this.performHitTest(mouseDown);

    if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      const currUnpair = this.morphSubPathService.getUnpairedSubPath();
      if (currUnpair && this.canvasType !== currUnpair.source) {
        const { source: fromSource, subIdx: fromSubIdx } = currUnpair;
        const toSource = this.canvasType;
        const toSubIdx = subIdx;
        this.morphSubPathService.setUnpairedSubPath(undefined);
        const fromSelections =
          this.selectionService.getSelections().filter(s => s.source === fromSource);
        const toSelections =
          this.selectionService.getSelections().filter(s => s.source === toSource);
        if (fromSelections.length) {
          this.selectionService.setSelections(fromSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === fromSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          }));
        } else if (toSelections.length) {
          this.selectionService.setSelections(toSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === toSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          }));
        }
        const pairedSubPaths = this.morphSubPathService.getPairedSubPaths();
        if (pairedSubPaths.has(fromSubIdx)) {
          pairedSubPaths.delete(fromSubIdx);
        }
        if (pairedSubPaths.has(toSubIdx)) {
          pairedSubPaths.delete(toSubIdx);
        }
        pairedSubPaths.add(pairedSubPaths.size);
        this.morphSubPathService.setPairedSubPaths(pairedSubPaths);
        this.hoverService.reset();
        this.stateService.updateActivePath(
          fromSource,
          this.stateService.getActivePathLayer(fromSource).pathData.mutate()
            .moveSubPath(fromSubIdx, 0)
            .build());
        this.stateService.updateActivePath(
          toSource,
          this.stateService.getActivePathLayer(toSource).pathData.mutate()
            .moveSubPath(toSubIdx, 0)
            .build());
      } else {
        this.morphSubPathService.setUnpairedSubPath({ source: this.canvasType, subIdx });
      }
      this.morphSubPathService.notify();
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
    this.hoverService.reset();
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
      this.hoverService.setHoverAndNotify({
        type: HoverType.SubPath,
        source: this.canvasType,
        subIdx,
      });
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

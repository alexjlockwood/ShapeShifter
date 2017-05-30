import { CanvasType } from '../CanvasType';
import { Point } from '../scripts/common';
import { MorphSubPathService } from '../services';
import {
  HoverType,
  SetPathHover,
  SetPathSelections,
  SetShapeShifterMode,
  ShapeShifterMode,
  State,
  Store,
  TogglePointSelection,
  ToggleSegmentSelections,
  ToggleSubPathSelection,
} from '../store';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import * as _ from 'lodash';

/**
 * Helper class that tracks information during morph subpath mode.
 */
export class MorphSubPathHelper {
  private readonly morphSubPathService: MorphSubPathService;
  private readonly canvasType: CanvasType;
  private readonly store: Store<State>;

  constructor(private readonly component: CanvasOverlayDirective) {
    this.morphSubPathService = component.morphSubPathService;
    this.canvasType = component.canvasType;
    this.store = component.store;
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
          this.component.shapeShifterSelections.filter(s => s.source === fromSource);
        const toSelections =
          this.component.shapeShifterSelections.filter(s => s.source === toSource);
        if (fromSelections.length) {
          this.store.dispatch(new SetPathSelections(fromSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === fromSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          })));
        } else if (toSelections.length) {
          this.store.dispatch(new SetPathSelections(toSelections.map(s => {
            const { subIdx: sIdx, cmdIdx, source, type } = s;
            return {
              subIdx: sIdx === toSubIdx ? 0 : sIdx,
              cmdIdx,
              source,
              type,
            };
          })));
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
        this.store.dispatch(new SetPathHover(undefined));
        // TODO: uncomment this
        // TODO: uncomment this
        // TODO: uncomment this
        // TODO: uncomment this
        // TODO: uncomment this
        // this.stateService.updateActivePath(
        //   fromSource,
        //   this.stateService.getActivePathLayer(fromSource).pathData.mutate()
        //     .moveSubPath(fromSubIdx, 0)
        //     .build());
        // this.stateService.updateActivePath(
        //   toSource,
        //   this.stateService.getActivePathLayer(toSource).pathData.mutate()
        //     .moveSubPath(toSubIdx, 0)
        //     .build());
      } else {
        this.morphSubPathService.setUnpairedSubPath({ source: this.canvasType, subIdx });
      }
      this.morphSubPathService.notify();
    } else if (!isShiftOrMetaPressed) {
      this.store.dispatch(new SetShapeShifterMode(ShapeShifterMode.Selection));
    }
  }

  onMouseMove(mouseMove: Point) {
    this.checkForHovers(mouseMove);
    this.component.draw();
  }

  onMouseUp(mouseUp: Point) {
    this.component.draw();
  }

  onMouseLeave(mouseLeave: Point) {
    this.store.dispatch(new SetPathHover(undefined));
    this.component.draw();
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint);
  }

  private checkForHovers(mousePoint: Point) {
    const hitResult = this.performHitTest(mousePoint);
    if (!hitResult.isHit) {
      this.store.dispatch(new SetPathHover(undefined));
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      this.store.dispatch(new SetPathHover({
        type: HoverType.SubPath,
        source: this.canvasType,
        subIdx,
      }));
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

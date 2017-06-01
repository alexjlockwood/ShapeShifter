import { CanvasType } from '../CanvasType';
import { Point } from '../scripts/common';
import { HoverService } from '../services';
import {
  HoverType,
  SelectPairedSubPath,
  SetShapeShifterMode,
  SetShapeShifterSelections,
  SetUnpairedSubPath,
  ShapeShifterMode,
  State,
  Store,
} from '../store';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import * as _ from 'lodash';

/**
 * Helper class that tracks information during morph subpath mode.
 */
export class MorphSubPathHelper {
  private readonly canvasType: CanvasType;
  private readonly store: Store<State>;

  constructor(private readonly component: CanvasOverlayDirective) {
    this.canvasType = component.canvasType;
    this.store = component.store;
  }

  onMouseDown(mouseDown: Point, isShiftOrMetaPressed: boolean) {
    const hitResult = this.performHitTest(mouseDown);

    if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      console.info('DISPATCHING', new SelectPairedSubPath(subIdx, this.canvasType));
      this.store.dispatch(new SelectPairedSubPath(subIdx, this.canvasType));
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
    this.component.hoverService.setHover(undefined);
    this.component.draw();
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint);
  }

  private checkForHovers(mousePoint: Point) {
    const hitResult = this.performHitTest(mousePoint);
    if (!hitResult.isHit) {
      this.component.hoverService.setHover(undefined);
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      this.component.hoverService.setHover({
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

import { ActionMode, ActionSource, HoverType } from 'app/model/actionmode';
import { Point } from 'app/scripts/common';
import { ActionModeService } from 'app/services';
import { State, Store } from 'app/store';
import * as _ from 'lodash';

import { CanvasOverlayDirective } from './canvasoverlay.directive';

// TODO: clean up this class' messy communication w/ the overlay directive

/**
 * Helper class that tracks information during morph subpath mode.
 */
export class PairSubPathHelper {
  private readonly actionSource: ActionSource;
  private readonly store: Store<State>;
  private readonly actionModeService: ActionModeService;

  constructor(private readonly component: CanvasOverlayDirective) {
    this.actionSource = component.actionSource;
    this.store = component.store;
    this.actionModeService = component.actionModeService;
  }

  onMouseDown(mouseDown: Point, isShiftOrMetaPressed: boolean) {
    const hitResult = this.performHitTest(mouseDown);

    if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      this.actionModeService.pairSubPath(subIdx, this.actionSource);
    } else if (!isShiftOrMetaPressed) {
      this.actionModeService.setActionMode(ActionMode.Selection);
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
    this.component.actionModeService.clearHover();
    this.component.draw();
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint);
  }

  private checkForHovers(mousePoint: Point) {
    const hitResult = this.performHitTest(mousePoint);
    if (!hitResult.isHit) {
      this.component.actionModeService.clearHover();
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPath(hits);
      this.component.actionModeService.setHover({
        type: HoverType.SubPath,
        source: this.actionSource,
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

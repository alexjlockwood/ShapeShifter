import * as _ from 'lodash';
import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath, HitResult } from '../scripts/paths';
import { Point, MathUtil } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  SelectionService, SelectionType,
  HoverService, HoverType,
} from '../services';

/**
 * Helper class that tracks information about a user's mouse gesture.
 */
export class PointSelector {
  private readonly stateService: StateService;
  private readonly selectionService: SelectionService;
  private readonly hoverService: HoverService;
  private readonly canvasType: CanvasType;
  private draggableSplitIndex: { subIdx: number, cmdIdx: number };
  private projectionOntoPath: ProjectionOntoPath;
  private isDragTriggered_ = false;
  private lastKnownMouseLocation: Point;
  private initialMouseDown: Point;

  constructor(private readonly component: CanvasComponent) {
    this.stateService = component.stateService;
    this.selectionService = component.selectionService;
    this.hoverService = component.hoverService;
    this.canvasType = component.canvasType;
  }

  onMouseDown(mouseDown: Point, isShiftOrMetaPressed: boolean) {
    this.initialMouseDown = mouseDown;
    this.lastKnownMouseLocation = mouseDown;

    const hitResult = this.performHitTest(mouseDown);
    if (hitResult.isEndPointHit) {
      const { subIdx, cmdIdx } =
        this.findHitCommandIndex(hitResult.endPointHits);
      const selectedCmd = this.component.activePath.getCommand(subIdx, cmdIdx);
      if (selectedCmd.isSplit()) {
        this.draggableSplitIndex = { subIdx, cmdIdx };
        this.component.showSelectCursor();
      } else {
        this.selectionService.toggle({
          type: SelectionType.Point,
          source: this.canvasType,
          subIdx,
          cmdIdx,
        }, isShiftOrMetaPressed);
      }
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPathIndex(hits);
      this.selectionService.toggle({
        type: SelectionType.SubPath,
        source: this.canvasType,
        subIdx,
      }, true);
    } else if (!isShiftOrMetaPressed) {
      // If the mouse down event didn't result in a hit, then
      // clear any existing selections, but only if the user isn't in
      // the middle of selecting multiple points at once.
      this.selectionService.reset();
    }
  }

  onMouseMove(mouseMove: Point) {
    this.lastKnownMouseLocation = mouseMove;
    if (this.draggableSplitIndex) {
      const distance = MathUtil.distance(this.initialMouseDown, mouseMove);
      if (this.component.dragTriggerTouchSlop < distance) {
        this.isDragTriggered_ = true;
      }
    }
    if (this.isDragTriggered_) {
      this.projectionOntoPath =
        this.component.calculateProjectionOntoPath(
          mouseMove, this.draggableSplitIndex.subIdx);
    } else {
      this.checkForHovers(mouseMove);
    }
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point) {
    this.lastKnownMouseLocation = mouseUp;
    if (this.isDragTriggered_) {
      const projOntoPath = this.projectionOntoPath;

      // TODO: Make this user experience better. There could be other subIdxs that we could use.
      const { subIdx: newSubIdx, cmdIdx: newCmdIdx } = projOntoPath;
      const { subIdx: oldSubIdx, cmdIdx: oldCmdIdx } = this.draggableSplitIndex;
      if (newSubIdx === oldSubIdx) {
        const activeLayer = this.stateService.getActivePathLayer(this.canvasType);
        const startingPath = activeLayer.pathData;
        let pathMutator = startingPath.mutate();

        // Note that the order is important here, as it preserves the command indices.
        if (newCmdIdx > oldCmdIdx) {
          pathMutator.splitCommand(newSubIdx, newCmdIdx, projOntoPath.projection.t);
          pathMutator.unsplitCommand(oldSubIdx, oldCmdIdx);
        } else if (newCmdIdx < oldCmdIdx) {
          pathMutator.unsplitCommand(oldSubIdx, oldCmdIdx);
          pathMutator.splitCommand(newSubIdx, newCmdIdx, projOntoPath.projection.t);
        } else {
          // Unsplitting will cause the projection t value to change, so recalculate the
          // projection before the split.
          // TODO: improve this API somehow... having to set the active layer here is kind of hacky
          activeLayer.pathData = pathMutator.unsplitCommand(oldSubIdx, oldCmdIdx).build();
          const tempProjOntoPath = this.component.calculateProjectionOntoPath(mouseUp);
          if (oldSubIdx === tempProjOntoPath.subIdx) {
            pathMutator.splitCommand(
              tempProjOntoPath.subIdx, tempProjOntoPath.cmdIdx, tempProjOntoPath.projection.t);
          } else {
            // If for some reason the projection subIdx changes after the unsplit, we have no
            // choice but to give up.
            // TODO: Make this user experience better. There could be other subIdxs that we could use.
            pathMutator = startingPath.mutate();
          }
        }

        // Notify the global layer state service about the change and draw.
        // Clear any existing selections and/or hovers as well.
        this.hoverService.reset();
        this.selectionService.reset();
        this.stateService.updateActivePath(this.canvasType, pathMutator.build());
      }
    } else if (this.draggableSplitIndex) {
      const hitResult = this.performHitTest(mouseUp);
      this.checkForSelections(hitResult);
    }

    this.checkForHovers(mouseUp);
    this.reset();
    this.component.draw();
  }

  onMouseLeave(mouseLeave: Point) {
    this.lastKnownMouseLocation = mouseLeave;
    this.reset();
    this.component.drawOverlays();
  }

  private performHitTest(mousePoint: Point) {
    const noSegments = !this.component.activePathLayer.isStroked();
    return this.component.performHitTest(mousePoint, { noSegments });
  }

  private reset() {
    this.initialMouseDown = undefined;
    this.projectionOntoPath = undefined;
    this.draggableSplitIndex = undefined;
    this.isDragTriggered_ = false;
    this.lastKnownMouseLocation = undefined;
    this.component.resetCursor();
  }

  isDragTriggered() {
    return this.isDragTriggered_;
  }

  getDraggableSplitIndex() {
    return this.draggableSplitIndex;
  }

  getProjectionOntoPath() {
    return this.projectionOntoPath;
  }

  getLastKnownMouseLocation() {
    return this.lastKnownMouseLocation;
  }

  private checkForHovers(mousePoint: Point) {
    const hitResult = this.performHitTest(mousePoint);
    if (!hitResult.isHit) {
      this.hoverService.reset();
    } else if (hitResult.isEndPointHit) {
      const { subIdx, cmdIdx } = this.findHitCommandIndex(hitResult.endPointHits);
      this.hoverService.setHover({
        type: HoverType.Point,
        source: this.canvasType,
        subIdx,
        cmdIdx,
      });
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPathIndex(hits);
      this.hoverService.setHover({
        type: HoverType.SubPath,
        source: this.canvasType,
        subIdx,
      });
    }
    if (!this.draggableSplitIndex) {
      const hover = this.hoverService.getHover();
      if (!this.draggableSplitIndex && hover && hover.type === HoverType.Point) {
        const { subIdx, cmdIdx } = hover;
        const cmd = this.component.activePath.getCommand(subIdx, cmdIdx);
        if (cmd.isSplit()) {
          this.component.showSelectCursor();
        } else {
          this.component.resetCursor();
        }
      } else {
        this.component.resetCursor();
      }
    }
  }

  private checkForSelections(hitResult: HitResult) {
    if (!hitResult.isHit) {
      this.selectionService.reset();
    } else if (hitResult.isEndPointHit) {
      const { subIdx, cmdIdx } = this.findHitCommandIndex(hitResult.endPointHits);
      this.selectionService.toggle({
        type: SelectionType.Point,
        source: this.canvasType,
        subIdx,
        cmdIdx,
      });
    } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      const { subIdx } = this.findHitSubPathIndex(hits);
      this.selectionService.toggle({
        type: SelectionType.SubPath,
        source: this.canvasType,
        subIdx,
      });
    }
  }

  private findHitCommandIndex(hits: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
    const endPointInfos = hits.map(index => {
      const { subIdx, cmdIdx } = index;
      const cmd = this.component.activePath.getSubPaths()[subIdx].getCommands()[cmdIdx];
      return { index, cmd };
    });
    const lastSplitIndex =
      _.findLastIndex(endPointInfos, cmdInfo => cmdInfo.cmd.isSplit());
    return endPointInfos[lastSplitIndex < 0 ? endPointInfos.length - 1 : lastSplitIndex].index;
  }

  private findHitSubPathIndex(hits: ReadonlyArray<{ subIdx: number }>) {
    const subPathInfos = hits.map(index => {
      const { subIdx } = index;
      const subPath = this.component.activePath.getSubPaths()[subIdx];
      return { index, subPath };
    });
    const lastSplitIndex =
      _.findLastIndex(subPathInfos, subPathInfo => subPathInfo.subPath.isSplit());
    return subPathInfos[lastSplitIndex < 0 ? subPathInfos.length - 1 : lastSplitIndex].index;
  }
}

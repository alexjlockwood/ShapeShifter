import * as _ from 'lodash';
import { CanvasComponent } from './canvas.component';
import { ProjectionOntoPath } from '../scripts/paths';
import { Point, MathUtil, Matrix } from '../scripts/common';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  SelectionService,
  SelectionType,
  HoverService,
  HoverType,
} from '../services';
import { LayerUtil } from '../scripts/layers';

/**
 * Helper class that tracks information about a user's mouse gesture, allowing
 * for the selection of path points, segments, and shapes.
 */
export class CanvasSelector {
  private readonly stateService: StateService;
  private readonly selectionService: SelectionService;
  private readonly hoverService: HoverService;
  private readonly canvasType: CanvasType;
  private currentDraggableSplitIndex: { subIdx: number, cmdIdx: number };
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
      const { subIdx, cmdIdx, cmd } = this.findHitPoint(hitResult.endPointHits);
      if (cmd.isSplit()) {
        // Then a click has occurred on top of a split point.
        // Don't select the point yet because the user might want
        // to drag it to a different location.
        this.currentDraggableSplitIndex = { subIdx, cmdIdx };
      } else {
        // Then a click has occurred on top of a non-split point.
        this.selectionService.togglePoint(this.canvasType, subIdx, cmdIdx, isShiftOrMetaPressed);
      }
      return;
    }

    // TODO: add ability to select individual segments so they can be deleted
    // if (this.component.activePathLayer.isFilled() && hitResult.isSegmentHit) {
    //   const { subIdx, cmdIdx, cmd } = this.findHitSegment(hitResult.segmentHits);
    //   if (cmd.isSubPathSplitSegment()) {
    //     this.selectionService.toggleSegment(
    //       this.canvasType, subIdx, cmdIdx, isShiftOrMetaPressed);
    //     return;
    //   }
    // }

    if (hitResult.isSegmentHit || hitResult.isShapeHit) {
      const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
      let { subIdx } = this.findHitSubPath(hits);
      const oppSubPathSelections =
        this.selectionService.getSelections()
          .filter(s => {
            return s.source !== this.canvasType
              && s.type === SelectionType.SubPath
              && s.subIdx !== subIdx;
          });
      if (oppSubPathSelections.length) {
        let { source: fromSource, subIdx: fromSubIdx } = oppSubPathSelections[0];
        let toSource = this.canvasType;
        let toSubIdx = subIdx;
        const numFromSubPaths =
          this.stateService.getActivePathLayer(fromSource).pathData.getSubPaths()
            .filter(s => !s.isCollapsing()).length;
        if (toSubIdx >= numFromSubPaths) {
          const tempFromSource = fromSource;
          fromSource = toSource;
          toSource = tempFromSource;
          const tempFromSubIdx = fromSubIdx;
          fromSubIdx = toSubIdx;
          toSubIdx = tempFromSubIdx;
        }
        this.hoverService.reset();
        this.selectionService.reset();
        this.stateService.updateActivePath(
          fromSource,
          this.stateService.getActivePathLayer(fromSource).pathData.mutate()
            .moveSubPath(fromSubIdx, toSubIdx)
            .build());
        subIdx = toSubIdx;
      }
      this.selectionService.toggleSubPath(this.canvasType, subIdx);
    } else if (!isShiftOrMetaPressed) {
      // If the mouse down event didn't result in a hit, then
      // clear any existing selections, but only if the user isn't in
      // the middle of selecting multiple points at once.
      this.selectionService.reset();
    }
  }

  onMouseMove(mouseMove: Point) {
    this.lastKnownMouseLocation = mouseMove;
    if (this.currentDraggableSplitIndex) {
      const distance = MathUtil.distance(this.initialMouseDown, mouseMove);
      if (this.component.dragTriggerTouchSlop < distance) {
        this.isDragTriggered_ = true;
      }
    }
    if (this.isDragTriggered_) {
      this.projectionOntoPath =
        this.calculateProjectionOntoPath(
          mouseMove, this.currentDraggableSplitIndex.subIdx);
    } else {
      this.checkForHovers(mouseMove);
    }
    this.component.drawOverlays();
  }

  onMouseUp(mouseUp: Point, isShiftOrMetaPressed: boolean) {
    this.lastKnownMouseLocation = mouseUp;
    if (this.isDragTriggered_) {
      const projOntoPath = this.projectionOntoPath;

      // TODO: Make this user experience better. There could be other subIdxs that we could use.
      const { subIdx: newSubIdx, cmdIdx: newCmdIdx } = projOntoPath;
      const { subIdx: oldSubIdx, cmdIdx: oldCmdIdx } = this.currentDraggableSplitIndex;
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
          const tempProjOntoPath = this.calculateProjectionOntoPath(mouseUp);
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
    } else if (this.currentDraggableSplitIndex) {
      const hitResult = this.performHitTest(mouseUp);
      if (!hitResult.isHit) {
        this.selectionService.reset();
      } else if (hitResult.isEndPointHit) {
        const { subIdx, cmdIdx } = this.findHitPoint(hitResult.endPointHits);
        this.selectionService.togglePoint(this.canvasType, subIdx, cmdIdx, isShiftOrMetaPressed);
      } else if (hitResult.isSegmentHit || hitResult.isShapeHit) {
        const hits = hitResult.isShapeHit ? hitResult.shapeHits : hitResult.segmentHits;
        const { subIdx } = this.findHitSubPath(hits);
        this.selectionService.toggleSubPath(this.canvasType, subIdx);
      }
    }

    this.reset();
    this.checkForHovers(mouseUp);
    this.component.draw();
  }

  onMouseLeave(mouseLeave: Point) {
    this.lastKnownMouseLocation = mouseLeave;
    this.reset();
    this.component.drawOverlays();
  }

  private performHitTest(mousePoint: Point) {
    return this.component.performHitTest(mousePoint);
  }

  private reset() {
    this.initialMouseDown = undefined;
    this.projectionOntoPath = undefined;
    this.currentDraggableSplitIndex = undefined;
    this.isDragTriggered_ = false;
    this.lastKnownMouseLocation = undefined;
    this.component.resetCursor();
  }

  isDragTriggered() {
    return this.isDragTriggered_;
  }

  getDraggableSplitIndex() {
    return this.currentDraggableSplitIndex;
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
      this.component.resetCursor();
    } else if (hitResult.isEndPointHit) {
      const { subIdx, cmdIdx } = this.findHitPoint(hitResult.endPointHits);
      this.hoverService.setHover({
        type: HoverType.Point,
        source: this.canvasType,
        subIdx,
        cmdIdx,
      });
      this.component.showPointerCursor();
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
    // TODO: add ability to hover over/select individual segments
  }

  private findHitSubPath(hits: ReadonlyArray<{ subIdx: number }>) {
    const infos = hits.map(index => {
      const { subIdx } = index;
      return { subIdx, subPath: this.component.activePath.getSubPath(subIdx) };
    });
    const lastSplitIndex = _.findLastIndex(infos, info => info.subPath.isSplit());
    return infos[lastSplitIndex < 0 ? infos.length - 1 : lastSplitIndex];
  }

  // private findHitSegment(hits: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
  //   const infos = hits.map(index => {
  //     const { subIdx, cmdIdx } = index;
  //     return { subIdx, cmdIdx, cmd: this.component.activePath.getCommand(subIdx, cmdIdx) };
  //   });
  //   const lastSplitIndex = _.findLastIndex(infos, info => info.cmd.isSubPathSplitSegment());
  //   return infos[lastSplitIndex < 0 ? infos.length - 1 : lastSplitIndex];
  // }

  private findHitPoint(hits: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
    const infos = hits.map(index => {
      const { subIdx, cmdIdx } = index;
      return { subIdx, cmdIdx, cmd: this.component.activePath.getCommand(subIdx, cmdIdx) };
    });
    const lastSplitIndex = _.findLastIndex(infos, info => info.cmd.isSplit());
    return infos[lastSplitIndex < 0 ? infos.length - 1 : lastSplitIndex];
  }

  /**
  * Calculates the projection onto the path with the specified path ID.
  * The resulting projection is our way of determining the on-curve point
  * closest to the specified off-curve mouse point.
  */
  private calculateProjectionOntoPath(mousePoint: Point, restrictToSubIdx?: number) {
    const transforms =
      LayerUtil.getTransformsForLayer(
        this.component.vectorLayer,
        this.component.stateService.getActivePathId(this.canvasType)).reverse();
    const transformedMousePoint =
      MathUtil.transformPoint(
        mousePoint,
        Matrix.flatten(...transforms).invert());
    const projInfo =
      this.component.activePath.project(transformedMousePoint, restrictToSubIdx);
    if (!projInfo) {
      return undefined;
    }
    return {
      subIdx: projInfo.subIdx,
      cmdIdx: projInfo.cmdIdx,
      projection: projInfo.projection,
    };
  }
}

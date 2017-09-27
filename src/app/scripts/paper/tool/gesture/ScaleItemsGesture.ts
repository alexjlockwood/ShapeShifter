import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { SelectionBoundsRaster } from 'app/scripts/paper/item';
import { Cursor, PaperUtil, PivotType, SnapUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import { Line, Ruler, SnapGuideInfo } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs scaling operations.
 *
 * TODO: should we also scale the stroke width or no?
 */
export class ScaleItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private localToVpItemMatrices: ReadonlyArray<paper.Matrix>;
  private initialPivot: paper.Point;
  private initialSize: paper.Point;
  private centeredInitialSize: paper.Point;
  private initialCenter: paper.Point;
  private initialDraggedSegment: paper.Point;
  private initialVectorLayer: VectorLayer;
  private downPoint: paper.Point;
  private point: paper.Point;

  constructor(
    private readonly ps: PaperService,
    private readonly selectionBoundsRaster: SelectionBoundsRaster,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayer(undefined);
    this.selectedItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.pl.findItemByLayerId(id),
    );
    this.localToVpItemMatrices = this.selectedItems.map(item => {
      // Compute the matrices to directly transform while performing rotations.
      return item.globalMatrix.prepended(this.pl.matrix.inverted()).inverted();
    });
    const bounds = PaperUtil.transformRectangle(
      PaperUtil.computeGlobalBounds(this.selectedItems),
      this.pl.matrix.inverted(),
    );
    this.initialPivot = bounds[this.selectionBoundsRaster.oppositePivotType];
    this.initialDraggedSegment = bounds[this.selectionBoundsRaster.pivotType];
    this.downPoint = bounds[this.selectionBoundsRaster.pivotType];
    this.initialSize = this.downPoint.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.multiply(0.5);
    this.initialCenter = bounds.center.clone();
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.point = this.pl.globalToLocal(event.point);
    const { x, y } = this.point;
    this.ps.setTooltipInfo({
      point: { x, y },
      // TODO: display the current width/height of the shape
      label: `${_.round(x, 1)} ⨯ ${_.round(y, 1)}`,
    });
    this.processEvent(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    // TODO: need to disable this in onKeyEvents as well?
    this.ps.setSnapGuideInfo(undefined);
    this.ps.setTooltipInfo(undefined);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  private processKeyEvent(event: paper.KeyEvent) {
    if (event.key === 'alt' || event.key === 'shift') {
      this.processEvent(event);
    }
  }

  // TODO: make sure it is possible to scale/shrink the item when holding shift?
  private processEvent(event: paper.Event) {
    const projectDownPoint = this.pl.localToGlobal(this.downPoint);
    const projectPoint = this.pl.localToGlobal(this.point);
    const projectDelta = projectPoint.subtract(projectDownPoint);

    let newVl = this.initialVectorLayer.clone();
    newVl = this.scaleItems(newVl, projectDelta, event.modifiers.alt, event.modifiers.shift);
    this.ps.setVectorLayer(newVl);

    // TODO: this could be WAY more efficient (no need to scale/snap things twice)
    const snapInfo = this.buildSnapInfo();
    if (snapInfo) {
      const {
        horizontal: { delta: horizontalDelta },
        vertical: { delta: verticalDelta },
      } = snapInfo;
      const projectSnapDelta = new paper.Point(
        isFinite(horizontalDelta) ? -horizontalDelta : 0,
        isFinite(verticalDelta) ? -verticalDelta : 0,
      );
      if (!projectSnapDelta.isZero()) {
        newVl = this.scaleItems(
          newVl,
          projectPoint.add(projectSnapDelta).subtract(projectDownPoint),
          event.modifiers.alt,
        );
        this.ps.setVectorLayer(newVl);
      }
    }

    this.ps.setSnapGuideInfo(this.buildSnapGuideInfo());
  }

  private scaleItems(
    newVl: VectorLayer,
    projectDelta: paper.Point,
    shouldScaleAboutCenter: boolean,
    shouldSnapDelta = false,
  ) {
    console.log(newVl, projectDelta, shouldScaleAboutCenter, shouldSnapDelta);
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    const fixedPivot = shouldScaleAboutCenter ? this.initialCenter : this.initialPivot;
    const currentSize = this.initialDraggedSegment
      .add(this.pl.globalToLocal(projectDelta))
      .subtract(fixedPivot);
    const initialSize = shouldScaleAboutCenter ? this.centeredInitialSize : this.initialSize;
    let sx = 1;
    let sy = 1;
    if (!MathUtil.isNearZero(initialSize.x)) {
      sx = currentSize.x / initialSize.x;
    }
    if (!MathUtil.isNearZero(initialSize.y)) {
      sy = currentSize.y / initialSize.y;
    }
    if (shouldSnapDelta) {
      const signx = sx > 0 ? 1 : -1;
      const signy = sy > 0 ? 1 : -1;
      sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
      sx *= signx;
      sy *= signy;
    }

    // TODO: this doesn't work yet for paths that are contained in scaled groups

    this.selectedItems.forEach((item, index) => {
      // TODO: make this stuff works for groups as well
      // TODO: should we pass 'false' to clone below?
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const localToViewportMatrix = this.localToVpItemMatrices[index];
      const matrix = localToViewportMatrix.clone();
      matrix.scale(sx, sy, fixedPivot);
      matrix.append(localToViewportMatrix.inverted());
      path.matrix = matrix;
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });

    return newVl;
  }

  private buildSnapInfo() {
    const selectedLayerIds = this.ps.getSelectedLayers();
    if (!selectedLayerIds.size) {
      return undefined;
    }
    const draggedItems = Array.from(selectedLayerIds).map(id => this.pl.findItemByLayerId(id));
    const { parent } = draggedItems[0];
    if (!draggedItems.every(item => item.parent === parent)) {
      // TODO: determine if there is an alternative to exiting early here?
      console.warn('All snapped items must share the same parent item.');
      return undefined;
    }
    const siblingItems = parent.children.filter(i => !draggedItems.includes(i));
    if (!siblingItems.length) {
      return undefined;
    }

    // Perform the snap test.
    const toSnapPointsFn = (items: ReadonlyArray<paper.Item>) => {
      const { topLeft, center, bottomRight } = PaperUtil.computeGlobalBounds(items);
      return [topLeft, center, bottomRight];
    };
    return SnapUtil.getSnapInfo(
      toSnapPointsFn(draggedItems),
      siblingItems.map(siblingItem => toSnapPointsFn([siblingItem])),
    );
  }

  private buildSnapGuideInfo(): SnapGuideInfo {
    const projectToViewportFn = ({ from, to }: Line) => {
      return {
        from: this.pl.globalToLocal(new paper.Point(from)),
        to: this.pl.globalToLocal(new paper.Point(to)),
      };
    };
    const snapInfo = this.buildSnapInfo();
    return {
      guides: SnapUtil.buildSnapGuides(snapInfo).map(projectToViewportFn),
      rulers: SnapUtil.buildSnapRulers(snapInfo).map(ruler => {
        return { ...ruler, line: projectToViewportFn(ruler.line) };
      }),
    };
  }
}

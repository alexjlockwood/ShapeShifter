import { LayerUtil, MorphableLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { MathUtil } from 'app/modules/editor/scripts/common';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer, SelectionBoundsRaster } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil, SnapUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import { Line } from 'app/modules/editor/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

/**
 * A gesture that performs scaling operations.
 *
 * Preconditions:
 * - The user is in default mode.
 * - One or more layers are selected.
 * - A mouse down event occurred on a selection bounds handle.
 *
 * TODO: should we also scale the stroke width?
 */
export class ScaleItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private localToVpItemMatrices: ReadonlyArray<paper.Matrix>;
  private vpInitialPivot: paper.Point;
  private vpInitialSize: paper.Point;
  private vpInitialCenteredSize: paper.Point;
  private vpInitialCenter: paper.Point;
  private vpInitialDraggedSegment: paper.Point;
  private vpDownPoint: paper.Point;
  private vpPoint: paper.Point;
  private initialVectorLayer: VectorLayer;

  constructor(
    private readonly ps: PaperService,
    private readonly selectionBoundsRaster: SelectionBoundsRaster,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayerId(undefined);

    // TODO: make searches like this more efficient...
    const scaleItems: paper.Item[] = [];
    const scaleItemsSet = new Set<string>();
    Array.from(this.ps.getSelectedLayerIds())
      .map(id => this.pl.findItemByLayerId(id))
      // TODO: reuse this code with PaperLayer (filter out empty groups)
      .filter(i => !(i instanceof paper.Group) || i.children.length)
      .forEach(function recurseFn(i: paper.Item) {
        if (i instanceof paper.Group) {
          i.children.forEach(recurseFn);
        } else if (!scaleItemsSet.has(i.data.id)) {
          scaleItemsSet.add(i.data.id);
          scaleItems.push(i);
        }
      });
    this.selectedItems = scaleItems;

    this.localToVpItemMatrices = this.selectedItems.map(item => {
      // Compute the matrices to directly transform during drag events.
      return item.globalMatrix.prepended(this.pl.matrix.inverted()).inverted();
    });
    const bounds = PaperUtil.transformRectangle(
      PaperUtil.computeBounds(this.selectedItems),
      this.pl.matrix.inverted(),
    );
    this.vpInitialPivot = bounds[this.selectionBoundsRaster.oppositePivotType];
    this.vpInitialDraggedSegment = bounds[this.selectionBoundsRaster.pivotType];
    this.vpDownPoint = bounds[this.selectionBoundsRaster.pivotType];
    this.vpPoint = this.vpDownPoint;
    this.vpInitialSize = this.vpDownPoint.subtract(this.vpInitialPivot);
    this.vpInitialCenteredSize = this.vpInitialSize.multiply(0.5);
    this.vpInitialCenter = bounds.center.clone();
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.vpPoint = this.pl.globalToLocal(event.point);
    const { x, y } = this.vpPoint;
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
    const projDownPoint = this.pl.localToGlobal(this.vpDownPoint);
    const projPoint = this.pl.localToGlobal(this.vpPoint);
    const projDelta = projPoint.subtract(projDownPoint);

    let newVl = this.initialVectorLayer.clone();
    newVl = this.scaleItems(newVl, projDelta, event.modifiers.alt, event.modifiers.shift);
    this.ps.setVectorLayer(newVl);

    // TODO: this could be WAY more efficient (no need to scale/snap things twice)
    // TODO: snap if shift is held and aspect ratio doesn't change?
    // TODO: first snap the widths and heights, then snap the guides
    const shouldSnap = !event.modifiers.shift;
    if (shouldSnap) {
      const snapInfo = this.buildSnapInfo();
      if (snapInfo) {
        const projSnapDelta = new paper.Point(snapInfo.projSnapDelta);
        if (!projSnapDelta.isZero()) {
          const shouldScaleAboutCenter = event.modifiers.alt;
          const vpFixedPivot = shouldScaleAboutCenter ? this.vpInitialCenter : this.vpInitialPivot;
          // TODO: confirm this is the correct way to fix the project snap delta?
          if (this.vpPoint.x < vpFixedPivot.x) {
            projSnapDelta.x *= -1;
          }
          if (this.vpPoint.y < vpFixedPivot.y) {
            projSnapDelta.y *= -1;
          }
          newVl = this.scaleItems(
            newVl,
            projPoint.add(projSnapDelta).subtract(projDownPoint),
            shouldScaleAboutCenter,
          );
          this.ps.setVectorLayer(newVl);
        }
      }
    }

    if (shouldSnap) {
      const snapInfo = this.buildSnapInfo();
      if (snapInfo) {
        this.ps.setSnapGuideInfo({
          guides: snapInfo.guides.map(g => this.projToVpLine(g)),
          rulers: snapInfo.rulers.map(r => this.projToVpLine(r)),
        });
      } else {
        this.ps.setSnapGuideInfo(undefined);
      }
    } else {
      this.ps.setSnapGuideInfo(undefined);
    }
  }

  private scaleItems(
    newVl: VectorLayer,
    projDelta: paper.Point,
    shouldScaleAboutCenter: boolean,
    shouldSnapDelta = false,
  ) {
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    const vpFixedPivot = shouldScaleAboutCenter ? this.vpInitialCenter : this.vpInitialPivot;
    const currentSize = this.vpInitialDraggedSegment
      .add(this.pl.globalToLocal(projDelta))
      .subtract(vpFixedPivot);
    const initialSize = shouldScaleAboutCenter ? this.vpInitialCenteredSize : this.vpInitialSize;
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

    // TODO: determine if we should be baking transforms into the children layers when scaling a group?
    this.selectedItems.forEach((item, index) => {
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const localToVpMatrix = this.localToVpItemMatrices[index];
      const matrix = localToVpMatrix.clone();
      matrix.scale(sx, sy, vpFixedPivot);
      matrix.append(localToVpMatrix.inverted());
      path.matrix = matrix;
      console.log(item.data.id);
      const newPl = newVl.findLayerById(item.data.id).clone() as MorphableLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });

    return newVl;
  }

  // TODO: reuse this code with SelectDragCloneItemsGesture
  private buildSnapInfo() {
    const selectedLayerIds = this.ps.getSelectedLayerIds();
    if (!selectedLayerIds.size) {
      return undefined;
    }
    const draggedItems = Array.from(selectedLayerIds).map(id => this.pl.findItemByLayerId(id));
    const { parent } = draggedItems[0];
    if (!draggedItems.every(item => item.parent === parent)) {
      // TODO: copy the behavior used in Sketch
      console.warn('All snapped items must share the same parent item.');
      return undefined;
    }
    const siblingItems = parent.children.filter(i => !draggedItems.includes(i));
    if (!siblingItems.length) {
      return undefined;
    }

    // Perform the snap test.
    const toSnapPointsFn = (items: ReadonlyArray<paper.Item>) => {
      const { topLeft, center, bottomRight } = PaperUtil.computeBounds(items);
      return [topLeft, center, bottomRight];
    };
    // TODO: also snap-to-VectorLayer bounds (similar to the dragging gesture)
    return SnapUtil.computeSnapInfo(
      toSnapPointsFn(draggedItems),
      siblingItems.map(siblingItem => toSnapPointsFn([siblingItem])),
      true /* snapToDimensions */,
    );
  }

  private projToVpLine({ from, to }: Line) {
    return {
      from: this.pl.globalToLocal(new paper.Point(from)),
      to: this.pl.globalToLocal(new paper.Point(to)),
    };
  }
}

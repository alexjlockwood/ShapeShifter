import { LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { TransformUtil } from 'app/modules/editor/scripts/common';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer, SelectionBoundsRaster } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that performs transform operations.
 *
 * Preconditions:
 * - The user is in default mode.
 * - One or more paths are selected.
 * - A mouse down event occurred on a selection bounds handle.
 *
 * TODO: finish this
 * TODO: fix crash that can occur when 3+ points are on same axis
 * TODO: could this work with generic items (not just paths)?
 * TODO: we need to also filter out non-empty groups (see PaperLayer.ts)
 */
export class TransformPathsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Path>;
  private localToVpItemMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private vpDownPoint: paper.Point;
  private vpPoint: paper.Point;
  private vpBounds: paper.Rectangle;

  constructor(
    private readonly ps: PaperService,
    private readonly selectionBoundsRaster: SelectionBoundsRaster,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayerId(undefined);
    this.selectedItems = Array.from(this.ps.getSelectedLayerIds()).map(
      id => this.pl.findItemByLayerId(id) as paper.Path,
    );
    const invertedPaperLayerMatrix = this.pl.matrix.inverted();
    this.localToVpItemMatrices = this.selectedItems.map(item => {
      // Compute the matrices to directly transform during drag events.
      return item.globalMatrix.prepended(invertedPaperLayerMatrix).inverted();
    });
    this.vpBounds = PaperUtil.transformRectangle(
      PaperUtil.computeBounds(this.selectedItems),
      this.pl.matrix.inverted(),
    );
    this.vpDownPoint = this.vpBounds[this.selectionBoundsRaster.pivotType];
    this.vpPoint = this.vpDownPoint;
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.vpPoint = this.pl.globalToLocal(event.point);
    this.processEvent(event);
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
    if (event.key === 'command') {
      this.processEvent(event);
    }
  }

  private processEvent(event: paper.Event) {
    if (!this.vpPoint) {
      return;
    }
    const sourcePoints = [
      this.vpBounds.topLeft,
      this.vpBounds.topRight,
      this.vpBounds.bottomRight,
      this.vpBounds.bottomLeft,
    ].map(({ x, y }) => [x, y] as [number, number]);
    const targetPoints = [...sourcePoints];
    const vpPoint = [this.vpPoint.x, this.vpPoint.y] as [number, number];
    switch (this.selectionBoundsRaster.pivotType) {
      case 'topLeft':
        targetPoints[0] = vpPoint;
        break;
      case 'topRight':
        targetPoints[1] = vpPoint;
        break;
      case 'bottomRight':
        targetPoints[2] = vpPoint;
        break;
      case 'bottomLeft':
        targetPoints[3] = vpPoint;
        break;
    }

    const distortFn = TransformUtil.distort(sourcePoints, targetPoints);

    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
      // TODO: make this stuff works for groups as well
      const path = item.clone() as paper.Path;
      const localToViewportMatrix = this.localToVpItemMatrices[index];
      const pathDistortFn = (point: paper.Point) => {
        point = localToViewportMatrix.transform(point);
        const intermediatePoint = distortFn([point.x, point.y]);
        point = new paper.Point(intermediatePoint[0], intermediatePoint[1]);
        point = localToViewportMatrix.inverted().transform(point);
        return point;
      };
      path.segments.forEach(segment => {
        if (segment.handleIn) {
          segment.handleIn = pathDistortFn(segment.point.add(segment.handleIn)).subtract(
            segment.point,
          );
        }
        if (segment.handleOut) {
          segment.handleOut = pathDistortFn(segment.point.add(segment.handleOut)).subtract(
            segment.point,
          );
        }
        segment.point = pathDistortFn(segment.point);
      });
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }
}

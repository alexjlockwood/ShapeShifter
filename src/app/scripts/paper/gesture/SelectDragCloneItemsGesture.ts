import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { MathUtil, Matrix } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import { Line, Ruler, SnapGuideInfo } from 'app/store/paper/actions';
import * as paper from 'paper';

import { Gesture } from './Gesture';
import { MouseSnapper } from './MouseSnapper';

const SNAP_TOLERANCE = 10;

/**
 * A gesture that performs selection, move, and clone operations
 * on one or more items. This gesture is only used during selection mode.
 *
 * TODO: don't allow modifications to be made to groups and paths/masks simultaneously
 * TODO: make it possible to drag/clone groups
 * TODO: show a 'grabbing' cursor while dragging items
 * TODO: confirm that it is impossible for vector layers to be translated/transformed
 * TODO: make it possible to drag/clone multiple items at a time (doesn't seem to work)
 */
export class SelectDragCloneItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private mouseSnapper: MouseSnapper;
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialItemPositions: ReadonlyArray<paper.Point>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private isDragging = false;

  // TODO: pressing alt should select the item directly beneath the hit item
  constructor(private readonly ps: PaperService, private readonly hitLayerId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // Clear the current hover layer, if it exists.
    this.ps.setHoveredLayer(undefined);

    const selectedLayers = new Set(this.ps.getSelectedLayers());
    if (!event.modifiers.shift && !selectedLayers.has(this.hitLayerId)) {
      // If shift isn't pressed, then clear any existing selections.
      selectedLayers.clear();
    }
    // Select the hit item.
    selectedLayers.add(this.hitLayerId);
    this.ps.setSelectedLayers(selectedLayers);

    // Save a copy of the initial vector layer so that we can make changes
    // to it as we drag.
    this.initialVectorLayer = this.ps.getVectorLayer();

    this.mouseSnapper = new MouseSnapper(this.ps);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const snapInfo = this.mouseSnapper.getSnapInfo(event);
    if (snapInfo) {
      const guides: Line[] = [];
      const rulers: Ruler[] = [];
      const newPointFn = (x: number, y: number) => {
        // Convert the point to viewport coordinates.
        return this.paperLayer.globalToLocal(new paper.Point(x, y));
      };
      if (snapInfo.horizontal.delta <= SNAP_TOLERANCE) {
        snapInfo.horizontal.values.forEach(value => {
          const { dragSnapBounds, siblingSnapBounds, values } = value;
          values.forEach(({ drag, sibling }) => {
            const guideTop = Math.min(dragSnapBounds.top, siblingSnapBounds.top);
            const guideBottom = Math.max(dragSnapBounds.bottom, siblingSnapBounds.bottom);
            const guideX = siblingSnapBounds[sibling];
            guides.push({
              from: newPointFn(guideX, guideTop),
              to: newPointFn(guideX, guideBottom),
            });
          });
        });
      }
      if (snapInfo.vertical.delta <= SNAP_TOLERANCE) {
        snapInfo.vertical.values.forEach(value => {
          const { dragSnapBounds: dsb, siblingSnapBounds: ssb, values } = value;
          values.forEach(({ drag, sibling }) => {
            const leftMostBounds = dsb.left < ssb.left ? dsb : ssb;
            const rightMostBounds = dsb.right < ssb.right ? ssb : dsb;
            const topMostBounds = dsb.top < ssb.top ? dsb : ssb;
            const nonTopMostBounds = dsb.top < ssb.top ? ssb : dsb;
            const bottomMostBounds = dsb.bottom < ssb.bottom ? ssb : dsb;
            const nonBottomMostBounds = dsb.bottom < ssb.bottom ? dsb : ssb;
            const shortestBounds = dsb.height < ssb.height ? dsb : ssb;
            const tallestBounds = dsb.height < ssb.height ? ssb : dsb;
            const guideLeft = leftMostBounds.left;
            const guideRight = rightMostBounds.right;
            const guideY = ssb[sibling];
            guides.push({
              from: newPointFn(guideLeft, guideY),
              to: newPointFn(guideRight, guideY),
            });
            const rulerLeft = leftMostBounds.right;
            const rulerRight = rightMostBounds.left;
            const rulerTop = nonTopMostBounds.top;
            const rulerBottom = nonBottomMostBounds.bottom;
            // TODO: handle the 'rulerTop === rulerBottom' case like sketch does
            const rulerY = rulerTop + (rulerBottom - rulerTop) * 0.5;
            const rulerFrom = newPointFn(rulerLeft, rulerY);
            const rulerTo = newPointFn(rulerRight, rulerY);
            rulers.push({
              line: { from: rulerFrom, to: rulerTo },
              delta: rulerTo.x - rulerFrom.x,
            });
          });
        });
      }
      this.ps.setSnapGuideInfo({ guides, rulers });
    } else {
      this.ps.setSnapGuideInfo(undefined);
    }

    if (!this.isDragging) {
      if (event.modifiers.alt) {
        // TODO: clone the selected items
      }
      this.isDragging = true;
    }

    // TODO: snap the dragged shapes as they are dragged
    // TODO: make sure groups and paths/masks aren't modified simultaneously
    let newVl = this.initialVectorLayer.clone();
    const translateLayerFn = (layerId: string, dist: paper.Point) => {
      const initialLayer = this.initialVectorLayer.findLayerById(layerId);
      if (initialLayer instanceof PathLayer || initialLayer instanceof ClipPathLayer) {
        const replacementLayer = initialLayer.clone();
        replacementLayer.pathData = initialLayer.pathData.transform(
          Matrix.translation(dist.x, dist.y),
        );
        newVl = LayerUtil.replaceLayer(newVl, layerId, replacementLayer);
      } else if (initialLayer instanceof GroupLayer) {
        const replacementLayer = initialLayer.clone();
        replacementLayer.translateX += dist.x;
        replacementLayer.translateY += dist.y;
        newVl = LayerUtil.replaceLayer(newVl, layerId, replacementLayer);
      }
    };

    const selectedItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.paperLayer.findItemByLayerId(id),
    );
    selectedItems.forEach(item => {
      const downPoint = item.globalToLocal(event.downPoint);
      const point = item.globalToLocal(event.point);
      const localDelta = point.subtract(downPoint);
      const finalDelta = event.modifiers.shift
        ? new paper.Point(MathUtil.snapVectorToAngle(localDelta, 90))
        : localDelta;
      translateLayerFn(item.data.id, finalDelta);
    });

    this.ps.setVectorLayer(newVl);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setSnapGuideInfo(undefined);
  }
}

import {
  ClipPathLayer,
  GroupLayer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { CursorType } from 'app/modules/editor/model/paper';
import { MathUtil, Matrix } from 'app/modules/editor/scripts/common';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil, SnapUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import { Line } from 'app/modules/editor/store/paper/actions';
import * as paper from 'paper';

/**
 * A gesture that performs selection, move, and clone operations
 * on one or more items.
 *
 * Preconditions:
 * - The user is in default mode.
 * - The user hit an item in the previous mousedown event.
 */
export class SelectDragCloneItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private initialVectorLayer: VectorLayer;
  private isDragging = false;

  constructor(private readonly ps: PaperService, private readonly hitLayerId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // Clear the current hover layer, if it exists.
    this.ps.setHoveredLayerId(undefined);

    const selectedLayers = new Set(this.ps.getSelectedLayerIds());
    if (!event.modifiers.shift && !selectedLayers.has(this.hitLayerId)) {
      // If shift isn't pressed and the hit layer isn't already selected,
      // then clear any existing selections.
      selectedLayers.clear();
    }

    // Select the hit item.
    selectedLayers.add(this.hitLayerId);
    this.ps.setSelectedLayerIds(selectedLayers);

    // Save a copy of the initial vector layer so that we can make changes
    // to it as we drag.
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    if (!this.isDragging) {
      this.isDragging = true;
      if (event.modifiers.alt) {
        // TODO: clone the selected items
      }
      this.ps.setCursorType(CursorType.Grabbing);
    }

    let newVl = this.initialVectorLayer.clone();
    newVl = this.dragItems(newVl, event.downPoint, event.point, event.modifiers.shift);
    this.ps.setVectorLayer(newVl);

    // TODO: this could be WAY more efficient (no need to drag/snap things twice)
    const snapInfo = this.buildSnapInfo();
    if (snapInfo) {
      const projSnapDelta = new paper.Point(snapInfo.projSnapDelta);
      if (!projSnapDelta.isZero()) {
        newVl = this.dragItems(newVl, event.downPoint, event.downPoint.add(projSnapDelta));
        this.ps.setVectorLayer(newVl);
      }
      const updatedSnapInfo = this.buildSnapInfo();
      this.ps.setSnapGuideInfo({
        guides: updatedSnapInfo.guides.map(g => this.projToVpLine(g)),
        rulers: updatedSnapInfo.rulers.map(r => this.projToVpLine(r)),
      });
    } else {
      this.ps.setSnapGuideInfo(undefined);
    }
  }

  // TODO: dragging a parent and child simultaneously doesn't work
  private dragItems(
    newVl: VectorLayer,
    projDownPoint: paper.Point,
    projPoint: paper.Point,
    shouldSnapDelta = false,
  ) {
    Array.from(this.ps.getSelectedLayerIds()).forEach(layerId => {
      const item = this.pl.findItemByLayerId(layerId);
      const localDown = item.globalToLocal(projDownPoint).transform(item.matrix);
      const localCurr = item.globalToLocal(projPoint).transform(item.matrix);
      const localDelta = localCurr.subtract(localDown);
      const localFinalDelta = shouldSnapDelta
        ? new paper.Point(MathUtil.snapVectorToAngle(localDelta, 90))
        : localDelta;
      newVl = dragItem(newVl, layerId, localFinalDelta);
    });
    return newVl;
  }

  // TODO: reuse this code with ScaleItemsGesture
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
    const isParentVectorLayer = parent.data.id === this.initialVectorLayer.id;
    if (!siblingItems.length && !isParentVectorLayer) {
      return undefined;
    }

    // Perform the snap test.
    const siblingSnapPointsTable = siblingItems.map(item => toSnapPoints([item]));
    if (isParentVectorLayer) {
      const { width, height } = this.initialVectorLayer;
      const topLeft = new paper.Point(0, 0);
      const bottomRight = parent.localToGlobal(new paper.Point(width, height));
      const center = bottomRight.divide(2);
      siblingSnapPointsTable.push([topLeft, center, bottomRight]);
    }
    return SnapUtil.computeSnapInfo(toSnapPoints(draggedItems), siblingSnapPointsTable);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setSnapGuideInfo(undefined);
    this.ps.setCursorType(CursorType.Default);
  }

  private projToVpLine({ from, to }: Line): Line {
    return {
      from: this.pl.globalToLocal(new paper.Point(from)),
      to: this.pl.globalToLocal(new paper.Point(to)),
    };
  }
}

// TODO: should we bake transforms into children (to be consistent with scale items gesture?)
function dragItem(newVl: VectorLayer, layerId: string, localDelta: paper.Point) {
  const initialLayer = newVl.findLayerById(layerId);
  const { x, y } = localDelta;
  if (initialLayer instanceof PathLayer || initialLayer instanceof ClipPathLayer) {
    const replacementLayer = initialLayer.clone();
    replacementLayer.pathData = initialLayer.pathData.transform(Matrix.translation(x, y));
    newVl = LayerUtil.replaceLayer(newVl, layerId, replacementLayer);
  } else if (initialLayer instanceof GroupLayer) {
    const replacementLayer = initialLayer.clone();
    replacementLayer.translateX += x;
    replacementLayer.translateY += y;
    newVl = LayerUtil.replaceLayer(newVl, layerId, replacementLayer);
  }
  return newVl;
}

function toSnapPoints(items: ReadonlyArray<paper.Item>) {
  const { topLeft, center, bottomRight } = PaperUtil.computeBounds(items);
  return [topLeft, center, bottomRight];
}

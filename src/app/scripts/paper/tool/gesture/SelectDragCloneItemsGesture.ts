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
import { Cursor, CursorUtil, PaperUtil, SnapUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import { Line, SnapGuideInfo } from 'app/store/paper/actions';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection, move, and clone operations
 * on one or more items.
 *
 * Preconditions:
 * - The user is in selection mode.
 * - The user hit an item in the previous mousedown event.
 */
export class SelectDragCloneItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialItemPositions: ReadonlyArray<paper.Point>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private isDragging = false;

  // TODO: dragging items that are contained in transformed groups currently doesn't work...
  constructor(private readonly ps: PaperService, private readonly hitLayerId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // Clear the current hover layer, if it exists.
    this.ps.setHoveredLayer(undefined);

    const selectedLayers = new Set(this.ps.getSelectedLayers());
    if (!event.modifiers.shift && !selectedLayers.has(this.hitLayerId)) {
      // If shift isn't pressed and the hit layer isn't already selected,
      // then clear any existing selections.
      selectedLayers.clear();
    }

    // Select the hit item.
    selectedLayers.add(this.hitLayerId);
    this.ps.setSelectedLayers(selectedLayers);

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
      CursorUtil.set(Cursor.Grabbing);
    }

    let newVl = this.initialVectorLayer.clone();
    newVl = this.dragItems(newVl, event.point.subtract(event.downPoint), event.modifiers.shift);
    this.ps.setVectorLayer(newVl);

    // TODO: this could be WAY more efficient (no need to drag/snap things twice)
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
        newVl = this.dragItems(newVl, projectSnapDelta);
        this.ps.setVectorLayer(newVl);
      }
    }

    this.ps.setSnapGuideInfo(this.buildSnapGuideInfo());
  }

  private dragItems(newVl: VectorLayer, projectDelta: paper.Point, shouldSnapDelta = false) {
    Array.from(this.ps.getSelectedLayers()).forEach(layerId => {
      const item = this.pl.findItemByLayerId(layerId);
      const localDelta = item.globalToLocal(projectDelta);
      const localFinalDelta = shouldSnapDelta
        ? new paper.Point(MathUtil.snapVectorToAngle(localDelta, 90))
        : localDelta;
      newVl = dragItem(newVl, layerId, localFinalDelta);
    });
    return newVl;
  }

  // TODO: reuse this code with ScaleItemsGesture
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
    return SnapUtil.computeSnapInfo(
      toSnapPointsFn(draggedItems),
      siblingItems.map(siblingItem => toSnapPointsFn([siblingItem])),
    );
  }

  // TODO: reuse this code with ScaleItemsGesture
  private buildSnapGuideInfo(): SnapGuideInfo {
    const projectToViewportFn = ({ from, to }: Line) => {
      return {
        from: this.pl.globalToLocal(new paper.Point(from)),
        to: this.pl.globalToLocal(new paper.Point(to)),
      };
    };
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    // TODO: use snap info to snap distances between bounds!
    const snapInfo = this.buildSnapInfo();
    console.log(snapInfo);
    const dsb = snapInfo.vertical.values[0].dragSnapBounds;
    return {
      guides: SnapUtil.buildGuides(snapInfo).map(projectToViewportFn),
      rulers: SnapUtil.buildRulers(snapInfo).map(projectToViewportFn),
    };
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setSnapGuideInfo(undefined);
    CursorUtil.clear();
  }
}

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

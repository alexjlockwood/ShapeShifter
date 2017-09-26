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
import { Line, Ruler, SnapGuideInfo } from 'app/store/paper/actions';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection, move, and clone operations
 * on one or more items.
 *
 * Preconditions:
 * - The user is in selection mode.
 * - The user just hit an item in a mousedown event.
 */
export class SelectDragCloneItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialItemPositions: ReadonlyArray<paper.Point>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private isDragging = false;

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

    Array.from(this.ps.getSelectedLayers()).forEach(layerId => {
      const item = this.pl.findItemByLayerId(layerId);
      const localDownPoint = item.globalToLocal(event.downPoint);
      const localPoint = item.globalToLocal(event.point);
      const localDelta = localPoint.subtract(localDownPoint);
      translateLayerFn(
        item.data.id,
        event.modifiers.shift
          ? new paper.Point(MathUtil.snapVectorToAngle(localDelta, 90))
          : localDelta,
      );
    });

    this.ps.setVectorLayer(newVl);

    // TODO: should we compute the snap before or after modifying the items?
    this.ps.setSnapGuideInfo(this.getSnapGuideInfo());
  }

  private getSnapGuideInfo(): SnapGuideInfo {
    const selectedLayerIds = this.ps.getSelectedLayers();
    if (!selectedLayerIds.size) {
      return undefined;
    }
    const dragItems = Array.from(selectedLayerIds).map(id => this.pl.findItemByLayerId(id));
    const { parent } = dragItems[0];
    if (!dragItems.every(item => item.parent === parent)) {
      // TODO: determine if there is an alternative to exiting early here?
      console.warn('All snapped items must share the same parent item.');
      return undefined;
    }
    const siblingItems = parent.children.filter(i => !dragItems.includes(i));
    if (!siblingItems.length) {
      return undefined;
    }

    // Perform the snap test.
    const toSnapPointsFn = (items: paper.Item[]) => {
      const { topLeft, center, bottomRight } = PaperUtil.computeGlobalBounds(items);
      return [topLeft, center, bottomRight];
    };
    const snapInfo = SnapUtil.getSnapInfo(
      toSnapPointsFn(dragItems),
      siblingItems.map(siblingItem => toSnapPointsFn([siblingItem])),
    );
    const projectToViewportFn = ({ from, to }: Line) => {
      return {
        from: this.pl.globalToLocal(new paper.Point(from)),
        to: this.pl.globalToLocal(new paper.Point(to)),
      };
    };
    return {
      guides: SnapUtil.buildSnapGuides(snapInfo).map(projectToViewportFn),
      rulers: SnapUtil.buildSnapRulers(snapInfo).map(ruler => ({
        ...ruler,
        line: projectToViewportFn(ruler.line),
      })),
    };
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setSnapGuideInfo(undefined);
    CursorUtil.clear();
  }
}

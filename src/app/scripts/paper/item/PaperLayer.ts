import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import { Items } from 'app/scripts/paper/util';
import * as _ from 'lodash';
import * as paper from 'paper';

import { HoverPath } from './HoverPath';
import { SelectedItemsGroup } from './SelectedItemsGroup';
import { SelectionBoxPath } from './SelectionBoxPath';
import { VectorLayerGroup } from './VectorLayerGroup';

// TODO: use Item#visible to hook up 'visible layer ids' from store
export class PaperLayer extends paper.Layer {
  private vectorLayerGroup = new paper.Group();
  private selectedItemsPath: paper.Path;
  private hoverPath: paper.Path;
  private selectionBoxPath: paper.Path;

  private selectedLayerIds = new Set<string>();
  private hoveredLayerId: string;

  setVectorLayer(vl: VectorLayer) {
    this.updateItemLayers(vl);
    this.updateSelectedLayers();
    this.updateHoveredLayer();
  }

  private updateItemLayers(vl: VectorLayer) {
    if (this.vectorLayerGroup) {
      this.vectorLayerGroup.remove();
    }
    this.vectorLayerGroup = new VectorLayerGroup(vl);
    this.updateChildren();
  }

  setSelectedLayers(layerIds: Set<string>) {
    this.selectedLayerIds = new Set(layerIds);
    this.updateSelectedLayers();
  }

  private updateSelectedLayers() {
    if (this.selectedItemsPath) {
      this.selectedItemsPath.remove();
      this.selectedItemsPath = undefined;
    }
    const selectedItems = Array.from(this.selectedLayerIds).map(this.findItemByLayerId);
    if (selectedItems.length) {
      // TODO: create the selected items path.
      // const rect = new paper.Path.Rectangle(bounds);
      // rect.curves[0].divideAtTime(0.5);
      // rect.curves[2].divideAtTime(0.5);
      // rect.curves[4].divideAtTime(0.5);
      // rect.curves[6].divideAtTime(0.5);
      // rect.strokeScaling = false;
      // rect.fullySelected = true;
      // rect.strokeWidth = 1 / paper.view.zoom;
      // rect.strokeColor = '#009dec';
    }
    this.updateChildren();
  }

  setHoveredLayer(layerId: string) {
    this.hoveredLayerId = layerId;
    this.updateHoveredLayer();
  }

  private updateHoveredLayer() {
    if (this.hoverPath) {
      this.hoverPath.remove();
      this.hoverPath = undefined;
    }
    if (this.hoveredLayerId) {
      const item = this.findItemByLayerId(this.hoveredLayerId);
      if (Items.isGroup(item)) {
        this.hoverPath = new paper.Path.Rectangle(item.bounds);
      } else if (Items.isPath(item)) {
        this.hoverPath = new paper.Path(item.segments);
        this.hoverPath.closed = item.closed;
      }
      if (this.hoverPath) {
        const scale = this.getScaleFactor();
        this.hoverPath.strokeColor = '#009dec';
        this.hoverPath.guide = true;
        this.hoverPath.strokeWidth = 2 / paper.view.zoom / scale;
      }
    }
    this.updateChildren();
  }

  setSelectionBox(from: paper.Point, to: paper.Point) {
    this.clearSelectionBox();
    const scale = this.getScaleFactor();
    const { zoom } = paper.view;
    const midPoint = new paper.Point(0.5 / zoom / scale, 0.5 / zoom / scale);
    this.selectionBoxPath = new paper.Path.Rectangle(
      new paper.Rectangle(from.add(midPoint), to.add(midPoint)),
    );
    this.selectionBoxPath.strokeWidth = 1 / zoom / scale;
    this.selectionBoxPath.guide = true;
    this.selectionBoxPath.strokeColor = '#aaaaaa';
    this.selectionBoxPath.dashArray = [3 / zoom / scale];
    this.updateChildren();
  }

  clearSelectionBox() {
    if (this.selectionBoxPath) {
      this.selectionBoxPath.remove();
      this.selectionBoxPath = undefined;
    }
  }

  private updateChildren() {
    const children = [];
    if (this.vectorLayerGroup) {
      children.push(this.vectorLayerGroup);
    }
    if (this.selectedItemsPath) {
      children.push(this.selectedItemsPath);
    }
    if (this.hoverPath) {
      children.push(this.hoverPath);
    }
    if (this.selectionBoxPath) {
      children.push(this.selectionBoxPath);
    }
    this.children = children;
  }

  findItemByLayerId(layerId: string) {
    return layerId && this.vectorLayerGroup
      ? _.first(this.vectorLayerGroup.getItems({ match: ({ data: { id } }) => layerId === id }))
      : undefined;
  }

  private getScaleFactor() {
    // Given unit vectors u0 = (0, 1) and v0 = (1, 0).
    //
    // After matrix mapping, we get u1 and v1. Let Θ be the angle between u1 and v1.
    // Then the final scale we want is:
    //
    // Math.min(|u1|sin(Θ),|v1|sin(Θ)) = |u1||v1|sin(Θ) / Math.max(|u1|,|v1|)
    //
    // If Math.max(|u1|,|v1|) = 0, that means either x or y has a scale of 0.
    //
    // For the non-skew case, which is most of the cases, matrix scale is
    // computing exactly the scale on x and y axis, and take the minimal of these two.
    //
    // For the skew case, an unit square will mapped to a parallelogram,
    // and this function will return the minimal height of the 2 bases.
    const { matrix } = this;
    const m = new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, 0, 0);
    const u0 = new paper.Point(0, 1);
    const v0 = new paper.Point(1, 0);
    const u1 = u0.transform(m);
    const v1 = v0.transform(m);
    const sx = Math.hypot(u1.x, u1.y);
    const sy = Math.hypot(v1.x, v1.y);
    const dotProduct = u1.y * v1.x - u1.x * v1.y;
    const maxScale = Math.max(sx, sy);
    return maxScale > 0 ? Math.abs(dotProduct) / maxScale : 0;
  }
}

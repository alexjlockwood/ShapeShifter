import { VectorLayer } from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import { Items, Layers, Transforms } from 'app/scripts/paper/util';
import * as _ from 'lodash';
import * as paper from 'paper';

// TODO: use Item#visible to hook up 'visible layer ids' from store
export class PaperLayer extends paper.Layer {
  private vectorLayerItem: paper.Item;
  private selectionBoundsItem: paper.Item;
  private hoverPath: paper.Path;
  private selectionBoxPath: paper.Path;
  private shapePreviewPath: paper.Path;

  private selectedLayerIds = new Set<string>();
  private hoveredLayerId: string;

  setVectorLayer(vl: VectorLayer) {
    this.updateVectorLayerItem(vl);
    this.updateSelectionBoundsItem();
    this.updateHoverPath();
  }

  setSelectedLayers(layerIds: Set<string>) {
    this.selectedLayerIds = new Set(layerIds);
    this.updateSelectionBoundsItem();
  }

  setHoveredLayer(layerId: string) {
    this.hoveredLayerId = layerId;
    this.updateHoverPath();
  }

  setShapePreview(pathData: string) {
    console.log(pathData);
    if (this.shapePreviewPath) {
      this.shapePreviewPath.remove();
      this.shapePreviewPath = undefined;
    }
    if (pathData) {
      this.shapePreviewPath = Layers.newShapePreview(pathData);
      this.updateChildren();
    }
  }

  setSelectionBox(box: { from: paper.Point; to: paper.Point }) {
    if (this.selectionBoxPath) {
      this.selectionBoxPath.remove();
      this.selectionBoxPath = undefined;
    }
    if (box) {
      this.selectionBoxPath = Layers.newSelectionBox(
        Transforms.mousePointToLocalCoordinates(box.from),
        Transforms.mousePointToLocalCoordinates(box.to),
      );
      this.updateChildren();
    }
  }

  private updateVectorLayerItem(vl: VectorLayer) {
    if (this.vectorLayerItem) {
      this.vectorLayerItem.remove();
    }
    this.vectorLayerItem = Layers.newVectorLayerItem(vl);
    this.updateChildren();
  }

  private updateSelectionBoundsItem() {
    if (this.selectionBoundsItem) {
      this.selectionBoundsItem.remove();
      this.selectionBoundsItem = undefined;
    }
    const selectedItems = Array.from(this.selectedLayerIds).map(layerId =>
      this.findItemByLayerId(layerId),
    );
    if (selectedItems.length > 0) {
      this.selectionBoundsItem = Layers.newSelectionBounds(selectedItems);
    }
    this.updateChildren();
  }

  private updateHoverPath() {
    if (this.hoverPath) {
      this.hoverPath.remove();
      this.hoverPath = undefined;
    }
    if (this.hoveredLayerId) {
      const item = this.findItemByLayerId(this.hoveredLayerId);
      this.hoverPath = Layers.newHover(item);
    }
    this.updateChildren();
  }

  private updateChildren() {
    const children: paper.Item[] = [];
    if (this.vectorLayerItem) {
      children.push(this.vectorLayerItem);
    }
    if (this.selectionBoundsItem) {
      children.push(this.selectionBoundsItem);
    }
    if (this.hoverPath) {
      children.push(this.hoverPath);
    }
    if (this.shapePreviewPath) {
      children.push(this.shapePreviewPath);
    }
    if (this.selectionBoxPath) {
      children.push(this.selectionBoxPath);
    }
    this.children = children;
  }

  /** Finds all vector layer items that overlap with the specified bounds. */
  findItemsInBounds(bounds: paper.Rectangle, partialOverlap: boolean) {
    return this.vectorLayerItem.getItems({
      // TODO: figure out how to deal with groups and compound paths
      // TODO: look at stylii to see how it handles paper.Shape items
      class: paper.Path,
      overlapping: partialOverlap ? new paper.Rectangle(bounds) : undefined,
      inside: partialOverlap ? undefined : new paper.Rectangle(bounds),
    });
  }

  findItemByLayerId(layerId: string) {
    if (this.vectorLayerItem.data.id === layerId) {
      return this.vectorLayerItem;
    }
    return layerId
      ? _.first(this.vectorLayerItem.getItems({ match: ({ data: { id } }) => layerId === id }))
      : undefined;
  }

  hitTestSelectionBounds(mousePoint: paper.Point) {
    const point = Transforms.mousePointToLocalCoordinates(mousePoint);
    return this.selectionBoundsItem.hitTest(point, {
      class: paper.Raster,
    });
  }
}

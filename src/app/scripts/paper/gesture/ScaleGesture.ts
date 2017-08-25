import { MathUtil } from 'app/scripts/common';
import { Guides, Handles, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/** A gesture that performs scaling operations. */
export class ScaleGesture extends Gesture {
  private selectedItems: ReadonlyArray<paper.Item>;
  private selectionBounds: paper.Rectangle;
  private initialPivot: paper.Point;
  private initialSize: paper.Point;
  private centeredInitialSize: paper.Point;
  private initialCenter: paper.Point;
  private currentHandle: paper.Point;
  private itemGroup: paper.Group;

  // @Override
  onMouseDown(event: paper.ToolEvent, { item }: paper.HitResult) {
    this.selectedItems = Selections.getSelectedItems();
    this.selectionBounds = this.selectedItems.reduce(
      (p, c) => p.unite(c.bounds),
      this.selectedItems[0].bounds,
    );
    const index = Guides.getScaleHandleIndex(item);
    const handleName = Handles.getHandleName(index);
    const oppHandleName = Handles.getOppositeHandleName(index);
    this.initialPivot = this.selectionBounds[oppHandleName].clone();
    this.currentHandle = this.selectionBounds[handleName].clone();
    this.initialSize = this.currentHandle.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.divide(2);
    this.initialCenter = this.selectionBounds.center.clone();

    // Don't show the selection bounds while transforming the shape.
    Guides.hideSelectionBounds();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    console.log('onMouseDrag');
    this.selectionBounds = Items.computeBoundingBox(this.selectedItems);
    // this.itemGroup = new paper.Group(this.selectedItems);
    // this.itemGroup.addChild(this.selectionBounds);
    // this.itemGroup.data.isHelperItem = true;
    // this.itemGroup.strokeScaling = false;
    // this.itemGroup.applyMatrix = false;
    // Scale about the center if alt is pressed. Otherwise scale about
    // the handle opposite of the currently active handle.
    const currentPivot = event.modifiers.alt ? this.initialCenter : this.initialPivot;
    this.currentHandle = this.currentHandle.add(event.delta);
    const currentSize = this.currentHandle.subtract(currentPivot);
    const initialSize = event.modifiers.alt ? this.centeredInitialSize : this.initialSize;
    let sx = 1;
    let sy = 1;
    if (MathUtil.isNearZero(initialSize.x)) {
      sx = currentSize.x / initialSize.x;
    }
    if (MathUtil.isNearZero(initialSize.y)) {
      sy = currentSize.y / initialSize.y;
    }
    if (event.modifiers.shift) {
      const signx = sx > 0 ? 1 : -1;
      const signy = sy > 0 ? 1 : -1;
      sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
      sx *= signx;
      sy *= signy;
    }
    this.selectedItems.forEach(i => i.scale(sx, sy, currentPivot));
    // this.boundsScaleHandles.forEach((handle, index) => {
    //   handle.position = itemGroup.bounds[Handles.getHandleName(index)];
    //   handle.bringToFront();
    // });
    // this.boundsRotHandles.forEach((handle, index) => {
    //   if (!handle) {
    //     return;
    //   }
    //   const cornerName = getRectCornerName(index);
    //   handle.position = itemGroup.bounds[cornerName].add(handle.data.offset);
    //   handle.bringToFront();
    // });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    // itemGroup.applyMatrix = true;
    // itemGroup.layer.addChildren(itemGroup.children);
    // itemGroup.remove();
  }

  private updateSelectionBounds() {}
}

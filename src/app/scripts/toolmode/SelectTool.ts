import { MathUtil } from 'app/scripts/common';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import * as ItemUtil from './ItemUtil';

enum Mode {
  None,
  Scale,
  Rotate,
  MoveShapes,
  CloneShapes,
  SelectionBox,
}

/**
 * A simple selection tool for moving, scaling, rotating, and selecting shapes.
 * TODO: figure out how to deal with right mouse clicks and double clicks
 */
export class SelectTool extends AbstractTool {
  private currentGesture: Gesture;

  // @Override
  protected onActivate() {}

  // @Override
  protected onMouseDown(event: paper.ToolEvent) {
    ItemUtil.hideHoverPath();

    const hitResult = paper.project.hitTest(event.point, this.createHitOptions());
    if (hitResult) {
      const hitItem = hitResult.item;
      if (ItemUtil.isScaleHandle(hitItem)) {
        this.currentGesture = new ScaleGesture();
      } else if (ItemUtil.isRotationHandle(hitItem)) {
        this.currentGesture = new RotateGesture();
      } else if (event.modifiers.shift && hitItem.selected) {
        // Simply de-select the event and we are done.
        this.currentGesture = new class extends Gesture {
          // @Override
          onMouseDown(e: paper.ToolEvent, { item }: paper.HitResult) {
            ItemUtil.setSelection(item, false);
          }
        }();
      } else {
        const shouldCloneShape = event.modifiers.alt;
        this.currentGesture = new SelectGesture(shouldCloneShape);
      }
    } else {
      this.currentGesture = new SelectionBoxGesture();
    }

    this.currentGesture.onMouseDown(event, hitResult);
  }

  // @Override
  protected onMouseDrag(event: paper.ToolEvent) {
    this.currentGesture.onMouseDrag(event);
  }

  // @Override
  protected onMouseMove(event: paper.ToolEvent) {
    ItemUtil.maybeCreateHoverPath(event.point, this.createHitOptions());
  }

  // @Override
  protected onMouseUp(event: paper.ToolEvent) {
    console.log('onMouseUp');
    this.currentGesture.onMouseUp(event);

    if (ItemUtil.getSelectedPaths().length) {
      ItemUtil.showOrHideSelectionGroup();
    } else {
      ItemUtil.hideSelectionGroup();
    }
  }

  // @Override
  protected onSingleClickConfirmed(event: paper.ToolEvent) {}

  // @Override
  protected onDoubleClick(event: paper.ToolEvent) {}

  // @Override
  protected onDeactivate() {}

  private createHitOptions(): paper.HitOptions {
    return {
      segments: true,
      stroke: true,
      curves: true,
      fill: true,
      tolerance: 8 / paper.view.zoom,
    };
  }
}

// TODO: make use of this function!
// var preProcessSelection = function() {
//   // when switching to the select tool while having a child object of a
//   // compound path selected, deselect the child and select the compound path
//   // instead. (otherwise the compound path breaks because of scale-grouping)
//   var items = pg.selection.getSelectedItems();
//   jQuery.each(items, function(index, item) {
//     if(pg.compoundPath.isCompoundPathChild(item)) {
//       var cp = pg.compoundPath.getItemsCompoundPath(item);
//       pg.selection.setItemSelection(item, false);
//       pg.selection.setItemSelection(cp, true);
//     }
//   });
//   setSelectionBounds();
// };

abstract class Gesture {
  onMouseDown(event: paper.ToolEvent, hitResult?: paper.HitResult) {}
  onMouseDrag(event: paper.ToolEvent) {}
  onMouseUp(event: paper.ToolEvent) {}
}

/** A gesture that performs selection operations. */
class SelectGesture extends Gesture {
  private selectedPaths: ReadonlyArray<paper.Item>;
  private initialPositions: ReadonlyArray<paper.Point>;

  constructor(private readonly shouldCloneShape: boolean) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent, { item }: paper.HitResult) {
    // Deselect all by default if the shift key isn't pressed
    // also needs some special love for compound paths and groups,
    // as their children are not marked as "selected".
    if (!event.modifiers.shift) {
      const root = ItemUtil.getParentLayer(item);
      // TODO: re-look at this stuff once we support groups and compound paths!
      // TODO: re-look at this stuff once we support groups and compound paths!
      // TODO: re-look at this stuff once we support groups and compound paths!
      // TODO: re-look at this stuff once we support groups and compound paths!
      // TODO: re-look at this stuff once we support groups and compound paths!
      if (ItemUtil.isGroup(root) || ItemUtil.isCompoundPath(root)) {
        if (!root.selected) {
          ItemUtil.deselectAll();
        }
      } else if (!item.selected) {
        ItemUtil.deselectAll();
      }
    }
    ItemUtil.setSelection(item, true);

    // While moving/cloning the shape, never show the selection bounds.
    if (this.shouldCloneShape) {
      ItemUtil.cloneSelection();
    }
    ItemUtil.hideSelectionGroup();

    this.selectedPaths = ItemUtil.getSelectedPaths();
    this.initialPositions = this.selectedPaths.map(path => path.position);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const dragVector = event.point.subtract(event.downPoint);
    this.selectedPaths.forEach((item, i) => {
      if (event.modifiers.shift) {
        const snapPoint = new paper.Point(MathUtil.snapDeltaToAngle(dragVector, Math.PI / 4));
        item.position = this.initialPositions[i].add(snapPoint);
      } else {
        item.position = item.position.add(event.delta);
      }
    });
  }
}

/** A gesture that selects multiple items using a bounded box. */
class SelectionBoxGesture extends Gesture {
  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      ItemUtil.hideSelectionGroup();
      ItemUtil.deselectAll();
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    ItemUtil.createSelectionBoxPath(event.downPoint, event.point).removeOnDrag();
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const path = ItemUtil.getSelectionBoxPath();
    if (path) {
      ItemUtil.processRectangularSelection(event, path);
      path.remove();
    }
  }
}

/** A gesture that performs scaling operations. */
class ScaleGesture extends Gesture {
  private scaleItems: paper.Item[];
  private pivot: paper.Point;
  private origPivot: paper.Point;
  private corner: paper.Point;
  private origSize: paper.Point;
  private origCenter: paper.Point;
  private itemGroup: paper.Group;
  private selectionBounds: paper.Path.Rectangle;

  // @Override
  onMouseDown(event: paper.ToolEvent, { item }: paper.HitResult) {
    // const selectedPaths = ItemUtil.getSelectedPaths();
    // this.selectionBounds = selectedPaths.map(i => i.bounds).reduce((p, c) => p.unite(c));
    // const position = ItemUtil.getScaleHandlePosition(item);
    // const oppCornerName = getOpposingRectCornerName(position);
    // const cornerName = getRectCornerName(position);
    // this.pivot = this.selectionBounds[oppCornerName].clone();
    // this.origPivot = this.selectionBounds[oppCornerName].clone();
    // this.corner = this.selectionBounds[cornerName].clone();
    // this.origSize = this.corner.subtract(this.pivot);
    // this.origCenter = this.selectionBounds.center.clone();
    // this.scaleItems = selectedPaths;

    // While transforming object, never show the bounds stuff.
    ItemUtil.hideSelectionGroup();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // const selectionBounds = ItemUtil.getSelectedPaths()
    //   .map(i => i.bounds)
    //   .reduce((p, c) => p.unite(c));
    // let modOrigSize = this.origSize;
    // this.itemGroup = new paper.Group(this.scaleItems);
    // this.itemGroup.addChild(this.selectionBounds);
    // this.itemGroup.data.isHelperItem = true;
    // this.itemGroup.strokeScaling = false;
    // this.itemGroup.applyMatrix = false;
    // if (event.modifiers.alt) {
    //   this.pivot = this.origCenter;
    //   modOrigSize = this.origSize.multiply(0.5);
    // } else {
    //   this.pivot = this.origPivot;
    // }
    // this.corner = this.corner.add(event.delta);
    // const size = this.corner.subtract(this.pivot);
    // let sx = 1;
    // let sy = 1;
    // if (Math.abs(modOrigSize.x) > 1e-9) {
    //   sx = size.x / modOrigSize.x;
    // }
    // if (Math.abs(modOrigSize.y) > 1e-9) {
    //   sy = size.y / modOrigSize.y;
    // }
    // if (event.modifiers.shift) {
    //   const signx = sx > 0 ? 1 : -1;
    //   const signy = sy > 0 ? 1 : -1;
    //   sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
    //   sx *= signx;
    //   sy *= signy;
    // }
    // this.itemGroup.scale(sx, sy, pivot);
    // this.boundsScaleHandles.forEach((handle, index) => {
    //   handle.position = itemGroup.bounds[getRectCornerName(index)];
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
}

/** A gesture that performs rotation operations. */
class RotateGesture extends Gesture {
  private groupPivot: paper.Point;
  private rotatingItems: paper.Item[];
  private rotationAngles: number[];

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.rotatingItems = ItemUtil.getSelectedPaths();
    const selectionBounds = this.rotatingItems.map(i => i.bounds).reduce((p, c) => p.unite(c));
    this.groupPivot = selectionBounds.center;
    this.rotationAngles = this.rotatingItems.map(() => event.point.subtract(this.groupPivot).angle);

    // While transforming object, never show the bounds.
    ItemUtil.hideSelectionGroup();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    let angle = event.point.subtract(this.groupPivot).angle;
    this.rotatingItems.forEach((item, i) => {
      if (event.modifiers.shift) {
        angle = Math.round(angle / 45) * 45;
        item.applyMatrix = false;
        item.pivot = this.groupPivot.clone();
        item.rotation = angle;
      } else {
        item.rotate(angle - this.rotationAngles[i], this.groupPivot);
      }
      this.rotationAngles[i] = angle;
    });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.rotatingItems.forEach(item => (item.applyMatrix = true));
  }
}

type CornerNameType =
  | 'bottomLeft'
  | 'leftCenter'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'rightCenter'
  | 'bottomRight'
  | 'bottomCenter';

const CORNER_NAMES: ReadonlyArray<CornerNameType> = [
  'bottomLeft',
  'leftCenter',
  'topLeft',
  'topCenter',
  'topRight',
  'rightCenter',
  'bottomRight',
  'bottomCenter',
];

const OPP_CORNER_NAMES: ReadonlyArray<CornerNameType> = ((arr: ReadonlyArray<CornerNameType>) =>
  arr.map((_, i) => arr[(i + arr.length / 2) % arr.length]))(CORNER_NAMES);

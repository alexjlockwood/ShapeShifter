import { MathUtil } from 'app/scripts/common';
import * as paper from 'paper';

import * as ItemUtil from './ItemUtil';
import { ToolWrapper } from './ToolWrapper';

/**
 * Selection tool that allows for the modification of segments and handles.
 * TODO: combine this tool with the select tool
 * TODO: figure out how to deal with right mouse clicks and double clicks
 */
export class DetailSelectTool extends ToolWrapper {
  private doRectSelection = false;
  private hitType: HitType;
  private lastEvent: paper.ToolEvent = undefined;
  private selectionDragged = false;

  // @Override
  onActivate() {}

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const { point, modifiers } = event;
    this.selectionDragged = false;
    this.hitType = undefined;
    let doubleClicked = false;

    if (this.lastEvent) {
      if (event.timeStamp - this.lastEvent.timeStamp < 250) {
        doubleClicked = true;
        if (!modifiers.shift) {
          ItemUtil.clearSelection();
        }
      } else {
        doubleClicked = false;
      }
    }
    this.lastEvent = event;

    ItemUtil.removeHoverPath();
    const hitResult = paper.project.hitTest(point, createHitOptions());
    if (!hitResult) {
      if (!modifiers.shift) {
        ItemUtil.clearSelection();
      }
      this.doRectSelection = true;
      return;
    }

    if (hitResult.type === 'fill' || doubleClicked) {
      this.hitType = 'fill';
      if (hitResult.item.selected) {
        if (modifiers.shift) {
          hitResult.item.fullySelected = false;
        }
        if (doubleClicked) {
          hitResult.item.selected = false;
          hitResult.item.fullySelected = true;
        }
        if (modifiers.option) {
          ItemUtil.cloneSelection();
        }
      } else {
        if (modifiers.shift) {
          hitResult.item.fullySelected = true;
        } else {
          paper.project.deselectAll();
          hitResult.item.fullySelected = true;

          if (modifiers.option) {
            ItemUtil.cloneSelection();
          }
        }
      }
      return;
    }

    if (hitResult.type === 'segment') {
      this.hitType = hitResult.type;

      if (hitResult.segment.selected) {
        // Selected points with no handles get handles if selected again.
        hitResult.segment.selected = true;
        if (modifiers.shift) {
          hitResult.segment.selected = false;
        }
      } else {
        if (modifiers.shift) {
          hitResult.segment.selected = true;
        } else {
          paper.project.deselectAll();
          hitResult.segment.selected = true;
        }
      }

      if (modifiers.option) {
        ItemUtil.cloneSelection();
      }
      return;
    }

    if (hitResult.type === 'stroke' || hitResult.type === 'curve') {
      this.hitType = 'curve';

      const { curve } = hitResult.location;
      if (modifiers.shift) {
        curve.selected = !curve.selected;
      } else if (!curve.selected) {
        paper.project.deselectAll();
        curve.selected = true;
      }

      if (modifiers.option) {
        ItemUtil.cloneSelection();
      }
      return;
    }
    if (hitResult.type === 'handle-in' || hitResult.type === 'handle-out') {
      this.hitType = hitResult.type;
      if (!modifiers.shift) {
        paper.project.deselectAll();
      }
      hitResult.segment.handleIn.selected = true;
      hitResult.segment.handleOut.selected = true;
      return;
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const { point, downPoint, delta, modifiers } = event;
    if (this.doRectSelection) {
      const box = ItemUtil.createSelectionBoxPath(event.downPoint, event.point);
      box.removeOnDrag();
      box.removeOnUp();
      return;
    }
    this.selectionDragged = true;

    const dragVector = point.subtract(downPoint);
    for (const item of ItemUtil.getSelectedPaths()) {
      if (this.hitType === 'fill' || !item.segments) {
        // If the item has a compound path as a parent, don't move its
        // own item, as it would lead to double movement.
        if (ItemUtil.isCompoundPath(item.parent)) {
          continue;
        }

        // Add the position of the item before the drag started
        // for later use in the snap calculation.
        // TODO: missing types
        if (!(item as any).origPos) {
          // TODO: missing types
          (item as any).origPos = item.position;
        }

        if (modifiers.shift) {
          // TODO: missing types
          item.position = (item as any).origPos.add(
            MathUtil.snapDeltaToAngle(dragVector, Math.PI / 4),
          );
        } else {
          item.position = item.position.add(delta);
        }
        continue;
      }

      for (const seg of item.segments) {
        // Add the point of the segment before the drag started
        // for later use in the snap calculation.
        // TODO: missing types
        if (!(seg as any).origPoint) {
          // TODO: missing types
          (seg as any).origPoint = seg.point.clone();
        }

        if (
          (this.hitType === 'segment' || this.hitType === 'stroke' || this.hitType === 'curve') &&
          seg.selected
        ) {
          if (modifiers.shift) {
            // TODO: missing types
            seg.point = (seg as any).origPoint.add(
              MathUtil.snapDeltaToAngle(dragVector, Math.PI / 4),
            );
          } else {
            seg.point = seg.point.add(event.delta);
          }
          continue;
        }
        if (this.hitType === 'handle-out' && seg.handleOut.selected) {
          // If option is pressed or handles have been split,
          // they're no longer parallel and move independently.
          if (modifiers.option || !seg.handleOut.isColinear(seg.handleIn)) {
            seg.handleOut = seg.handleOut.add(delta);
          } else {
            seg.handleIn = seg.handleIn.subtract(delta);
            seg.handleOut = seg.handleOut.add(delta);
          }
          continue;
        }
        if (this.hitType === 'handle-in' && seg.handleIn.selected) {
          // If option is pressed or handles have been split,
          // they're no longer parallel and move independently.
          if (modifiers.option || !seg.handleOut.isColinear(seg.handleIn)) {
            seg.handleIn = seg.handleIn.add(delta);
          } else {
            seg.handleIn = seg.handleIn.add(delta);
            seg.handleOut = seg.handleOut.subtract(delta);
          }
          continue;
        }
      }
    }
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    ItemUtil.maybeCreateHoverPath(event.point, createHitOptions());
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.doRectSelection) {
      const path = ItemUtil.getSelectionBoxPath();
      if (path) {
        ItemUtil.processRectangularSelection(event, path);
        path.remove();
      }
    } else {
      if (this.selectionDragged) {
        this.selectionDragged = false;
      }
      // Resetting the items and segments origin points for the next usage.
      for (const item of ItemUtil.getSelectedPaths()) {
        // TODO: missing types
        (item as any).origPos = undefined;
        if (item.segments) {
          // TODO: missing types
          item.segments.forEach(seg => ((seg as any).origPoint = undefined));
        }
      }
    }
    this.doRectSelection = false;
  }

  // @Override
  onDeactivate() {
    ItemUtil.removeHoverPath();
  }
}

function createHitOptions(): paper.HitOptions {
  return {
    segments: true,
    stroke: true,
    curves: true,
    handles: true,
    fill: true,
    tolerance: 3 / paper.view.zoom,
  };
}

type HitType = 'fill' | 'stroke' | 'curve' | 'segment' | 'handle-in' | 'handle-out';

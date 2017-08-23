import * as paper from 'paper';

import { ToolWrapper } from './ToolWrapper';
import * as GuideUtil from './util/GuideUtil';
import * as HoverUtil from './util/HoverUtil';
import * as ToolUtil from './util/ToolUtil';

/**
 * Selection tool that allows for the modification of segments and handles.
 */
export class DirectSelectTool extends ToolWrapper {
  // TODO: somehow combine this tool with the select tool?
  // TODO: figure out how capture/restore selection state was used in this tool
  constructor() {
    super();

    const hitOptions = {
      segments: true,
      stroke: true,
      curves: true,
      handles: true,
      fill: true,
      // TODO: figure out which one to use ('guide' or 'guides')
      guide: false,
      guides: false,
      tolerance: 3 / paper.view.zoom,
    } as any; // TODO: missing types

    let doRectSelection = false;
    let selectionRect: paper.Path.Rectangle;
    let hitType: 'fill' | 'stroke' | 'curve' | 'segment' | 'handle-in' | 'handle-out';
    let lastEvent: paper.ToolEvent = undefined;
    let selectionDragged = false;

    this.tool.on({
      // TODO: figure out how activate/deactivate works here?
      // activate: () => ToolsUtil.setCanvasCursor(Cursor.ArrowWhite),
      deactivate: () => HoverUtil.clearHoveredItem(),
      mousedown: (event: paper.ToolEvent) => {
        const { point, modifiers } = event;
        selectionDragged = false;
        hitType = undefined;
        let doubleClicked = false;

        if (lastEvent) {
          if (event.timeStamp - lastEvent.timeStamp < 250) {
            doubleClicked = true;
            if (!modifiers.shift) {
              ToolUtil.clearSelection();
            }
          } else {
            doubleClicked = false;
          }
        }
        lastEvent = event;

        HoverUtil.clearHoveredItem();
        const hitResult = paper.project.hitTest(point, hitOptions);
        if (!hitResult) {
          if (!modifiers.shift) {
            ToolUtil.clearSelection();
          }
          doRectSelection = true;
          return;
        }

        if (hitResult.type === 'fill' || doubleClicked) {
          hitType = 'fill';
          if (hitResult.item.selected) {
            if (modifiers.shift) {
              hitResult.item.fullySelected = false;
            }
            if (doubleClicked) {
              hitResult.item.selected = false;
              hitResult.item.fullySelected = true;
            }
            if (modifiers.option) {
              ToolUtil.cloneSelection();
            }
          } else {
            if (modifiers.shift) {
              hitResult.item.fullySelected = true;
            } else {
              paper.project.deselectAll();
              hitResult.item.fullySelected = true;

              if (modifiers.option) {
                ToolUtil.cloneSelection();
              }
            }
          }
        } else if (hitResult.type === 'segment') {
          hitType = hitResult.type;

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
            ToolUtil.cloneSelection();
          }
        } else if (hitResult.type === 'stroke' || hitResult.type === 'curve') {
          hitType = 'curve';

          const curve = hitResult.location.curve;
          if (modifiers.shift) {
            curve.selected = !curve.selected;
          } else if (!curve.selected) {
            paper.project.deselectAll();
            curve.selected = true;
          }

          if (modifiers.option) {
            ToolUtil.cloneSelection();
          }
        } else if (hitResult.type === 'handle-in' || hitResult.type === 'handle-out') {
          hitType = hitResult.type;
          if (!modifiers.shift) {
            paper.project.deselectAll();
          }
          hitResult.segment.handleIn.selected = true;
          hitResult.segment.handleOut.selected = true;
        }
      },
      mousedrag: (event: paper.ToolEvent) => {
        const { point, downPoint, delta, modifiers } = event;
        if (doRectSelection) {
          selectionRect = GuideUtil.rectSelect(event);
          // Remove this rect on the next drag and up event
          selectionRect.removeOnDrag();
          return;
        }
        selectionDragged = true;

        const dragVector = point.subtract(downPoint);
        for (const item of ToolUtil.getSelectedPaths()) {
          if (hitType === 'fill' || !item.segments) {
            // If the item has a compound path as a parent, don't move its
            // own item, as it would lead to double movement.
            if (item.parent instanceof paper.CompoundPath) {
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
                ToolUtil.snapDeltaToAngle(dragVector, Math.PI * 2 / 8),
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
              (hitType === 'segment' || hitType === 'stroke' || hitType === 'curve') &&
              seg.selected
            ) {
              if (modifiers.shift) {
                // TODO: missing types
                seg.point = (seg as any).origPoint.add(
                  ToolUtil.snapDeltaToAngle(dragVector, Math.PI * 2 / 8),
                );
              } else {
                seg.point = seg.point.add(event.delta);
              }
              continue;
            }
            if (hitType === 'handle-out' && seg.handleOut.selected) {
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
            if (hitType === 'handle-in' && seg.handleIn.selected) {
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
      },
      mousemove: (event: paper.ToolEvent) => HoverUtil.handleHoveredItem(hitOptions, event),
      mouseup: (event: paper.ToolEvent) => {
        if (doRectSelection && selectionRect) {
          ToolUtil.processRectangularSelection(event, selectionRect, true);
          selectionRect.remove();
        } else {
          if (selectionDragged) {
            // pg.undo.snapshot('moveSelection');
            selectionDragged = false;
          }
          // Resetting the items and segments origin points for the next usage.
          for (const item of ToolUtil.getSelectedPaths()) {
            // TODO: missing types
            (item as any).origPos = undefined;
            if (item.segments) {
              // TODO: missing types
              item.segments.forEach(seg => ((seg as any).origPoint = undefined));
            }
          }
        }
        doRectSelection = false;
        selectionRect = undefined;
      },
    });
  }
}

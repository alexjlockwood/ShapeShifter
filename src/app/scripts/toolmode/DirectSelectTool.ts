import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { Cursor } from './ToolsUtil';

enum Mode {
  None,
  MoveShapes,
  MovePoints,
  MoveHandle,
  BoxSelect,
}

/**
 * Selection tool that allows for the modification of segments and handles.
 */
export class DirectSelectTool extends AbstractTool {
  private hitResult: paper.HitResult;

  // TODO: somehow combine this tool with the select tool?
  // TODO: figure out how capture/restore selection state was used in this tool
  constructor(private readonly toolState: ToolState) {
    super();

    let initialMousePoint = new paper.Point(0, 0);
    let mode = Mode.None;
    let hasSelectionChanged = false;
    let initialSelectionState: SelectionState[];
    let initialHandleIn: paper.Point;
    let initialHandleOut: paper.Point;

    this.on({
      // TODO: figure out how activate/deactivate works here?
      activate: () => ToolsUtil.setCanvasCursor(Cursor.ArrowWhite),
      deactivate: () => toolState.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        mode = Mode.None;
        hasSelectionChanged = false;
        initialMousePoint = event.point.clone();

        if (this.hitResult) {
          if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
            const hitItem = this.hitResult.item;
            if (event.modifiers.shift) {
              // Toggle the selected item.
              // TODO: make sure that parent layers are also deselected
              hitItem.selected = !hitItem.selected;
            } else {
              // Deselect all other selections and select the hit item.
              // TODO: figure out what this code was meant to do (caused parent layers from being deselected)
              // if (!hitItem.selected) {
              ToolsUtil.deselectAll();
              // }
              hitItem.selected = true;
            }
            if (hitItem.selected) {
              mode = Mode.MoveShapes;
              ToolsUtil.deselectAllSegments();
              initialSelectionState = ToolsUtil.captureSelectionState();
            }
          } else if (this.hitResult.type === 'segment') {
            const hitSegment = this.hitResult.segment;
            if (event.modifiers.shift) {
              hitSegment.selected = !hitSegment.selected;
            } else {
              if (!hitSegment.selected) {
                ToolsUtil.deselectAllSegments();
              }
              hitSegment.selected = true;
            }
            if (hitSegment.selected) {
              mode = Mode.MovePoints;
              initialSelectionState = ToolsUtil.captureSelectionState();
            }
          } else if (this.hitResult.type === 'handle-in' || this.hitResult.type === 'handle-out') {
            mode = Mode.MoveHandle;
            const hitSegment = this.hitResult.segment;
            initialHandleIn = hitSegment.handleIn.clone();
            initialHandleOut = hitSegment.handleOut.clone();
          }
          this.toolState.updateSelectionBounds();
        } else {
          // Clicked on and empty area, engage box select.
          mode = Mode.BoxSelect;
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        hasSelectionChanged = true;
        switch (mode) {
          case Mode.MoveShapes: {
            ToolsUtil.setCanvasCursor(Cursor.ArrowSmall);
            let delta = event.point.subtract(initialMousePoint);
            if (event.modifiers.shift) {
              delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
            }
            ToolsUtil.restoreSelectionState(initialSelectionState);
            paper.project
              .getSelectedItems()
              .forEach(item => (item.position = item.position.add(delta)));
            this.toolState.updateSelectionBounds();
            break;
          }
          case Mode.MovePoints: {
            ToolsUtil.setCanvasCursor(Cursor.ArrowSmall);
            let delta = event.point.subtract(initialMousePoint);
            if (event.modifiers.shift) {
              delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
            }
            ToolsUtil.restoreSelectionState(initialSelectionState);
            paper.project.getSelectedItems().forEach(path => {
              if (path instanceof paper.Path) {
                path.segments.forEach(segment => {
                  if (segment.selected) {
                    segment.point = segment.point.add(delta);
                  }
                });
              }
            });
            this.toolState.updateSelectionBounds();
            break;
          }
          case Mode.MoveHandle: {
            const delta = event.point.subtract(initialMousePoint);
            if (this.hitResult.type === 'handle-out') {
              let handlePos = initialHandleOut.add(delta);
              if (event.modifiers.shift) {
                handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
              }
              this.hitResult.segment.handleOut = handlePos;
              this.hitResult.segment.handleIn = handlePos.normalize(-initialHandleIn.length);
            } else {
              let handlePos = initialHandleIn.add(delta);
              if (event.modifiers.shift) {
                handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
              }
              this.hitResult.segment.handleIn = handlePos;
              this.hitResult.segment.handleOut = handlePos.normalize(-initialHandleOut.length);
            }
            this.toolState.updateSelectionBounds();
            break;
          }
          case Mode.BoxSelect: {
            ToolsUtil.createDragRect(initialMousePoint, event.point);
            break;
          }
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        if (mode === Mode.MoveShapes || mode === Mode.MovePoints || Mode.MoveHandle) {
          if (hasSelectionChanged) {
            this.toolState.clearSelectionBounds();
          }
        } else if (mode === Mode.BoxSelect) {
          const box = new paper.Rectangle(initialMousePoint, event.point);
          if (!event.modifiers.shift) {
            ToolsUtil.deselectAll();
          }
          const selectedSegments = ToolsUtil.getSegmentsInRect(box);
          selectedSegments.forEach(s => (s.selected = !s.selected));
          if (selectedSegments.length === 0) {
            ToolsUtil.getPathsIntersectingRect(box).forEach(p => (p.selected = !p.selected));
          }
        }
        this.toolState.updateSelectionBounds();

        // TODO: is this already handled in the hit test code below?
        if (this.hitResult) {
          if (this.hitResult.item.selected) {
            ToolsUtil.setCanvasCursor(Cursor.ArrowSmall);
          } else {
            ToolsUtil.setCanvasCursor(Cursor.ArrowWhiteShape);
          }
        }
      },
    });
  }

  // @Override
  dispatchHitTest(type: string, event: HitTestArgs, toolMode: ToolMode) {
    return toolMode === ToolMode.DirectSelect && this.hitTest(event);
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
    const hitSize = 4;
    let hit = undefined;
    this.hitResult = undefined;

    // Hit test items.
    if (point) {
      this.hitResult = paper.project.hitTest(point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    // Hit test selected handles.
    hit = undefined;
    if (point) {
      hit = paper.project.hitTest(point, {
        selected: true,
        handles: true,
        tolerance: hitSize,
      });
    }
    if (hit) {
      this.hitResult = hit;
    }

    // Hit test points.
    hit = undefined;
    if (point) {
      hit = paper.project.hitTest(point, { segments: true, tolerance: hitSize });
    }
    if (hit) {
      this.hitResult = hit;
    }

    if (this.hitResult) {
      if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
        if (this.hitResult.item.selected) {
          ToolsUtil.setCanvasCursor(Cursor.ArrowSmall);
        } else {
          ToolsUtil.setCanvasCursor(Cursor.ArrowWhiteShape);
        }
      } else if (
        this.hitResult.type === 'segment' ||
        this.hitResult.type === 'handle-in' ||
        this.hitResult.type === 'handle-out'
      ) {
        if (this.hitResult.segment.selected) {
          ToolsUtil.setCanvasCursor(Cursor.ArrowSmallPoint);
        } else {
          ToolsUtil.setCanvasCursor(Cursor.ArrowWhitePoint);
        }
      }
    } else {
      ToolsUtil.setCanvasCursor(Cursor.ArrowWhite);
    }

    return true;
  }
}

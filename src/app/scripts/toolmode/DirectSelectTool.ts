import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

enum Mode {
  None,
  MoveShapes,
  MovePoints,
  MoveHandle,
  BoxSelect,
}

export class DirectSelectTool extends AbstractTool {
  private hitResult: paper.HitResult;

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    let mouseStartPos = new paper.Point(0, 0);
    let mode = Mode.None;
    let originalContent: SelectionState[];
    let hasChanged = false;
    let originalHandleIn: paper.Point;
    let originalHandleOut: paper.Point;

    this.on({
      activate: () => ToolsUtil.setCanvasCursor('cursor-arrow-white'),
      deactivate: () => {},
      mousedown: (event: paper.MouseEvent) => {
        mode = undefined;
        hasChanged = false;

        if (this.hitResult) {
          if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
            if (event.modifiers.shift) {
              this.hitResult.item.selected = !this.hitResult.item.selected;
            } else {
              if (!this.hitResult.item.selected) {
                ToolsUtil.deselectAll();
              }
              this.hitResult.item.selected = true;
            }
            if (this.hitResult.item.selected) {
              mode = Mode.MoveShapes;
              ToolsUtil.deselectAllPoints();
              mouseStartPos = event.point.clone();
              originalContent = ToolsUtil.captureSelectionState();
            }
          } else if (this.hitResult.type === 'segment') {
            if (event.modifiers.shift) {
              this.hitResult.segment.selected = !this.hitResult.segment.selected;
            } else {
              if (!this.hitResult.segment.selected) {
                ToolsUtil.deselectAllPoints();
              }
              this.hitResult.segment.selected = true;
            }
            if (this.hitResult.segment.selected) {
              mode = Mode.MovePoints;
              mouseStartPos = event.point.clone();
              originalContent = ToolsUtil.captureSelectionState();
            }
          } else if (this.hitResult.type === 'handle-in' || this.hitResult.type === 'handle-out') {
            mode = Mode.MoveHandle;
            mouseStartPos = event.point.clone();
            originalHandleIn = this.hitResult.segment.handleIn.clone();
            originalHandleOut = this.hitResult.segment.handleOut.clone();
            // if (this.hitResult.type === 'handle-out') {
            //   this.originalHandlePos = this.hitResult.segment.handleOut.clone();
            //   this.originalOppHandleLength = this.hitResult.segment.handleIn.length;
            // } else {
            //   this.originalHandlePos = this.hitResult.segment.handleIn.clone();
            //   this.originalOppHandleLength = this.hitResult.segment.handleOut.length;
            // }
            // this.originalContent = captureSelectionState(); // For some reason this does not work!
          }
          this.helper.updateSelectionBounds();
        } else {
          // Clicked on and empty area, engage box select.
          mouseStartPos = event.point.clone();
          mode = Mode.BoxSelect;
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (mode === Mode.MoveShapes) {
          if (hasChanged) {
            this.helper.clearSelectionBounds();
          }
        } else if (mode === Mode.MovePoints) {
          if (hasChanged) {
            this.helper.clearSelectionBounds();
          }
        } else if (mode === Mode.MoveHandle) {
          if (hasChanged) {
            this.helper.clearSelectionBounds();
          }
        } else if (mode === Mode.BoxSelect) {
          const box = new paper.Rectangle(mouseStartPos, event.point);

          if (!event.modifiers.shift) {
            ToolsUtil.deselectAll();
          }

          const selectedSegments = ToolsUtil.getSegmentsInRect(box);
          if (selectedSegments.length > 0) {
            for (const segment of selectedSegments) {
              segment.selected = !segment.selected;
            }
          } else {
            const selectedPaths = ToolsUtil.getPathsIntersectingRect(box);
            for (const path of selectedPaths) {
              path.selected = !path.selected;
            }
          }
        }

        this.helper.updateSelectionBounds();

        if (this.hitResult) {
          if (this.hitResult.item.selected) {
            ToolsUtil.setCanvasCursor('cursor-arrow-small');
          } else {
            ToolsUtil.setCanvasCursor('cursor-arrow-white-shape');
          }
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        hasChanged = true;
        if (mode === Mode.MoveShapes) {
          ToolsUtil.setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(mouseStartPos);
          if (event.modifiers.shift) {
            delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          ToolsUtil.restoreSelectionState(originalContent);

          const selected = paper.project.getSelectedItems();
          for (const item of selected) {
            item.position = item.position.add(delta);
          }
          this.helper.updateSelectionBounds();
        } else if (mode === Mode.MovePoints) {
          ToolsUtil.setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(mouseStartPos);
          if (event.modifiers.shift) {
            delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          ToolsUtil.restoreSelectionState(originalContent);

          const selected = paper.project.getSelectedItems();
          for (const path of selected) {
            if (path instanceof paper.Path) {
              for (const segment of path.segments) {
                if (segment.selected) {
                  segment.point = segment.point.add(delta);
                }
              }
            }
          }
          this.helper.updateSelectionBounds();
        } else if (mode === Mode.MoveHandle) {
          const delta = event.point.subtract(mouseStartPos);

          if (this.hitResult.type === 'handle-out') {
            let handlePos = originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleOut = handlePos;
            this.hitResult.segment.handleIn = handlePos.normalize(-originalHandleIn.length);
          } else {
            let handlePos = originalHandleIn.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleIn = handlePos;
            this.hitResult.segment.handleOut = handlePos.normalize(-originalHandleOut.length);
          }

          this.helper.updateSelectionBounds();
        } else if (mode === Mode.BoxSelect) {
          ToolsUtil.dragRect(mouseStartPos, event.point);
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  // @Override
  dispatchHitTest(type: string, event: HitTestArgs, mode: string) {
    if (mode !== ToolMode.DirectSelect) {
      return undefined;
    }
    return this.hitTest(event);
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
          ToolsUtil.setCanvasCursor('cursor-arrow-small');
        } else {
          ToolsUtil.setCanvasCursor('cursor-arrow-white-shape');
        }
      } else if (
        this.hitResult.type === 'segment' ||
        this.hitResult.type === 'handle-in' ||
        this.hitResult.type === 'handle-out'
      ) {
        if (this.hitResult.segment.selected) {
          ToolsUtil.setCanvasCursor('cursor-arrow-small-point');
        } else {
          ToolsUtil.setCanvasCursor('cursor-arrow-white-point');
        }
      }
    } else {
      ToolsUtil.setCanvasCursor('cursor-arrow-white');
    }

    return true;
  }
}

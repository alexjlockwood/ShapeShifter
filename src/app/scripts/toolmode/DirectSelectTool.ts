import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

export class DirectSelectTool extends AbstractTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private originalContent: SelectionState[];
  private changed = false;
  private duplicates: SelectionState[];
  private originalHandleIn: paper.Point;
  private originalHandleOut: paper.Point;

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    this.on({
      activate: () => ToolsUtil.setCanvasCursor('cursor-arrow-white'),
      deactivate: () => {},
      mousedown: (event: paper.MouseEvent) => {
        this.mode = undefined;
        this.changed = false;

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
              this.mode = 'move-shapes';
              ToolsUtil.deselectAllPoints();
              this.mouseStartPos = event.point.clone();
              this.originalContent = ToolsUtil.captureSelectionState();
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
              this.mode = 'move-points';
              this.mouseStartPos = event.point.clone();
              this.originalContent = ToolsUtil.captureSelectionState();
            }
          } else if (this.hitResult.type === 'handle-in' || this.hitResult.type === 'handle-out') {
            this.mode = 'move-handle';
            this.mouseStartPos = event.point.clone();
            this.originalHandleIn = this.hitResult.segment.handleIn.clone();
            this.originalHandleOut = this.hitResult.segment.handleOut.clone();
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
          this.mouseStartPos = event.point.clone();
          this.mode = 'box-select';
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === 'move-shapes') {
          if (this.changed) {
            this.helper.clearSelectionBounds();
          }
        } else if (this.mode === 'move-points') {
          if (this.changed) {
            this.helper.clearSelectionBounds();
          }
        } else if (this.mode === 'move-handle') {
          if (this.changed) {
            this.helper.clearSelectionBounds();
          }
        } else if (this.mode === 'box-select') {
          const box = new paper.Rectangle(this.mouseStartPos, event.point);

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
        this.changed = true;
        if (this.mode === 'move-shapes') {
          ToolsUtil.setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(this.mouseStartPos);
          if (event.modifiers.shift) {
            delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          ToolsUtil.restoreSelectionState(this.originalContent);

          const selected = paper.project.getSelectedItems();
          for (const item of selected) {
            item.position = item.position.add(delta);
          }
          this.helper.updateSelectionBounds();
        } else if (this.mode === 'move-points') {
          ToolsUtil.setCanvasCursor('cursor-arrow-small');

          let delta = event.point.subtract(this.mouseStartPos);
          if (event.modifiers.shift) {
            delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
          }
          ToolsUtil.restoreSelectionState(this.originalContent);

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
        } else if (this.mode === 'move-handle') {
          const delta = event.point.subtract(this.mouseStartPos);

          if (this.hitResult.type === 'handle-out') {
            let handlePos = this.originalHandleOut.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleOut = handlePos;
            this.hitResult.segment.handleIn = handlePos.normalize(-this.originalHandleIn.length);
          } else {
            let handlePos = this.originalHandleIn.add(delta);
            if (event.modifiers.shift) {
              handlePos = ToolsUtil.snapDeltaToAngle(handlePos, Math.PI * 2 / 8);
            }
            this.hitResult.segment.handleIn = handlePos;
            this.hitResult.segment.handleOut = handlePos.normalize(-this.originalHandleOut.length);
          }

          this.helper.updateSelectionBounds();
        } else if (this.mode === 'box-select') {
          ToolsUtil.dragRect(this.mouseStartPos, event.point);
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  // @Override
  dispatchHitTest(type: string, event: HitTestArgs, mode: string) {
    if (mode !== 'tool-direct-select') {
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

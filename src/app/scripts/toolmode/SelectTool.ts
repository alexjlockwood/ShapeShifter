import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

enum Mode {
  None,
  MoveShapes,
  BoxSelect,
}

export class SelectTool extends AbstractTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode = Mode.None;
  private hitResult: paper.HitResult;
  private originalContent: SelectionState[];
  private changed = false;
  private duplicates: paper.Item[];

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.helper.updateSelectionBounds();
        this.helper.showSelectionBounds();
      },
      deactivate: () => this.helper.hideSelectionBounds(),
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
              this.mode = Mode.MoveShapes;
              ToolsUtil.deselectAllPoints();
              this.mouseStartPos = event.point.clone();
              this.originalContent = ToolsUtil.captureSelectionState();
            }
          }
          this.helper.updateSelectionBounds();
        } else {
          // Clicked on and empty area, engage box select.
          this.mouseStartPos = event.point.clone();
          this.mode = Mode.BoxSelect;
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === Mode.MoveShapes) {
          if (this.changed) {
            this.helper.clearSelectionBounds();
            // undo.snapshot('Move Shapes');
          }
          this.duplicates = undefined;
        } else if (this.mode === Mode.BoxSelect) {
          const box = new paper.Rectangle(this.mouseStartPos, event.point);

          if (!event.modifiers.shift) {
            ToolsUtil.deselectAll();
          }

          const selectedPaths = ToolsUtil.getPathsIntersectingRect(box);
          for (const path of selectedPaths) {
            path.selected = !path.selected;
          }
        }

        this.helper.updateSelectionBounds();

        if (this.hitResult) {
          if (this.hitResult.item.selected) {
            ToolsUtil.setCanvasCursor('cursor-arrow-small');
          } else {
            ToolsUtil.setCanvasCursor('cursor-arrow-black-shape');
          }
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (this.mode === Mode.MoveShapes) {
          this.changed = true;

          if (event.modifiers.option) {
            if (!this.duplicates) {
              this.createDuplicates(this.originalContent);
            }
            ToolsUtil.setCanvasCursor('cursor-arrow-duplicate');
          } else {
            if (this.duplicates) {
              this.removeDuplicates();
            }
            ToolsUtil.setCanvasCursor('cursor-arrow-small');
          }

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
        } else if (this.mode === Mode.BoxSelect) {
          ToolsUtil.dragRect(this.mouseStartPos, event.point);
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  private createDuplicates(content: SelectionState[]) {
    this.duplicates = [];
    for (const orig of content) {
      const item: paper.Item = paper.project.importJSON(orig.json) as any;
      if (item) {
        item.selected = false;
        this.duplicates.push(item);
      }
    }
  }

  private removeDuplicates() {
    for (const dup of this.duplicates) {
      dup.remove();
    }
    this.duplicates = undefined;
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
    const hitSize = 4;
    this.hitResult = undefined;

    // Hit test items.
    if (point) {
      this.hitResult = paper.project.hitTest(point, {
        fill: true,
        stroke: true,
        tolerance: hitSize,
      });
    }

    if (this.hitResult) {
      if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
        if (this.hitResult.item.selected) {
          ToolsUtil.setCanvasCursor('cursor-arrow-small');
        } else {
          ToolsUtil.setCanvasCursor('cursor-arrow-black-shape');
        }
      }
    } else {
      ToolsUtil.setCanvasCursor('cursor-arrow-black');
    }

    return true;
  }
}

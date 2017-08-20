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
  private hitResult: paper.HitResult;
  private duplicates: paper.Item[];

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    let mouseStartPos = new paper.Point(0, 0);
    let mode = Mode.None;
    let originalContent: SelectionState[];
    let hasChanged = false;

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.helper.updateSelectionBounds();
        this.helper.showSelectionBounds();
      },
      deactivate: () => this.helper.hideSelectionBounds(),
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
          this.duplicates = undefined;
        } else if (mode === Mode.BoxSelect) {
          const box = new paper.Rectangle(mouseStartPos, event.point);

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
        if (mode === Mode.MoveShapes) {
          hasChanged = true;

          if (event.modifiers.option) {
            if (!this.duplicates) {
              this.createDuplicates(originalContent);
            }
            ToolsUtil.setCanvasCursor('cursor-arrow-duplicate');
          } else {
            if (this.duplicates) {
              this.removeDuplicates();
            }
            ToolsUtil.setCanvasCursor('cursor-arrow-small');
          }

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
        } else if (mode === Mode.BoxSelect) {
          ToolsUtil.dragRect(mouseStartPos, event.point);
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

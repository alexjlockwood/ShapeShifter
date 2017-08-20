import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

enum SelectionMode {
  None,
  MoveShapes,
  BoxSelect,
}

export class SelectTool extends AbstractTool {
  private hitResult: paper.HitResult;
  private duplicates: paper.Item[];

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    let initialMousePoint: paper.Point;
    let selectionMode = SelectionMode.None;
    let hasSelectionChanged = false;
    let initialSelectionState: SelectionState[];

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.helper.updateSelectionBounds();
        this.helper.showSelectionBounds();
      },
      deactivate: () => this.helper.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        selectionMode = SelectionMode.None;
        hasSelectionChanged = false;
        initialMousePoint = event.point.clone();

        if (this.hitResult) {
          // TODO: make it possible to select the selection rectangle too?
          if (this.hitResult.type === 'fill' || this.hitResult.type === 'stroke') {
            const hitItem = this.hitResult.item;
            if (event.modifiers.shift) {
              // Toggle the selected item.
              hitItem.selected = !hitItem.selected;
            } else {
              // Deselect all other selections and select the hit item.
              if (!hitItem.selected) {
                ToolsUtil.deselectAll();
              }
              hitItem.selected = true;
            }
            if (hitItem.selected) {
              // Clicked on a shape, engage move shape mode. Deselect all segments
              // so that only the selected shapes remain.
              selectionMode = SelectionMode.MoveShapes;
              initialMousePoint = event.point.clone();
              ToolsUtil.deselectAllSegments();
              initialSelectionState = ToolsUtil.captureSelectionState();
            }
          }
          this.helper.updateSelectionBounds();
        } else {
          // Clicked on and empty area, engage box select mode.
          selectionMode = SelectionMode.BoxSelect;
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        switch (selectionMode) {
          case SelectionMode.MoveShapes: {
            hasSelectionChanged = true;
            if (event.modifiers.option) {
              if (!this.duplicates) {
                this.createDuplicates(initialSelectionState);
              }
              ToolsUtil.setCanvasCursor('cursor-arrow-duplicate');
            } else {
              if (this.duplicates) {
                this.duplicates.forEach(dup => dup.remove());
                this.duplicates = undefined;
              }
              ToolsUtil.setCanvasCursor('cursor-arrow-small');
            }

            let delta = event.point.subtract(initialMousePoint);
            if (event.modifiers.shift) {
              delta = ToolsUtil.snapDeltaToAngle(delta, Math.PI * 2 / 8);
            }

            ToolsUtil.restoreSelectionState(initialSelectionState);
            paper.project
              .getSelectedItems()
              .forEach(item => (item.position = item.position.add(delta)));
            this.helper.updateSelectionBounds();
            break;
          }
          case SelectionMode.BoxSelect: {
            ToolsUtil.createDragRect(initialMousePoint, event.point);
            break;
          }
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        switch (selectionMode) {
          case SelectionMode.MoveShapes: {
            if (hasSelectionChanged) {
              this.helper.clearSelectionBounds();
            }
            this.duplicates = undefined;
            break;
          }
          case SelectionMode.BoxSelect: {
            if (!event.modifiers.shift) {
              ToolsUtil.deselectAll();
            }
            const box = new paper.Rectangle(initialMousePoint, event.point);
            ToolsUtil.getPathsIntersectingRect(box).forEach(p => (p.selected = !p.selected));
            break;
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
    });
  }

  private createDuplicates(content: SelectionState[]) {
    this.duplicates = [];
    for (const orig of content) {
      // TODO: missing types
      const item: paper.Item = paper.project.importJSON(orig.json) as any;
      if (item) {
        item.selected = false;
        this.duplicates.push(item);
      }
    }
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

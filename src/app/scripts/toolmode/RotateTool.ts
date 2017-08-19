import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

export class RotateTool extends AbstractTool {
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private originalCenter: paper.Point;
  private originalAngle: number;
  private originalContent: SelectionState[];
  private originalShape: string;
  private cursorDir: paper.Point;
  private changed = false;

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
          if (this.hitResult.type === 'bounds') {
            this.originalContent = ToolsUtil.captureSelectionState();
            this.originalShape = this.helper
              .getSelectionBoundsShape()
              .exportJSON({ asString: false });
            this.mode = 'rotate';
            this.originalCenter = this.helper.getSelectionBounds().center.clone();
            const delta = event.point.subtract(this.originalCenter);
            this.originalAngle = Math.atan2(delta.y, delta.x);
          }
          this.helper.updateSelectionBounds();
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === 'rotate') {
          if (this.changed) {
            this.helper.clearSelectionBounds();
            // undo.snapshot('Rotate Shapes');
          }
        }
        this.helper.updateSelectionBounds();
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (this.mode === 'rotate') {
          const delta = event.point.subtract(this.originalCenter);
          const angle = Math.atan2(delta.y, delta.x);
          let da = angle - this.originalAngle;

          if (event.modifiers.shift) {
            const snapeAngle = Math.PI / 4;
            da = Math.round(da / snapeAngle) * snapeAngle;
          }

          ToolsUtil.restoreSelectionState(this.originalContent);

          const id = this.helper.getSelectionBoundsShape().id;
          this.helper.getSelectionBoundsShape().importJSON(this.originalShape);
          this.helper.getSelectionBoundsShape()._id = id;

          const deg = da / Math.PI * 180;

          this.helper.getSelectionBoundsShape().rotate(deg, this.originalCenter);

          const selected = paper.project.getSelectedItems();
          for (const item of selected) {
            console.log(item);
            if ((item as any).guide) {
              continue;
            }
            item.rotate(deg, this.originalCenter);
          }

          ToolsUtil.setCanvasRotateCursor(this.cursorDir, da);
          this.changed = true;
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  testHot(type: string, event: { point: paper.Point; modifiers?: any }, mode: string) {
    return this.hitTest(event);
  }

  private hitTest({ point }: { point: paper.Point; modifiers?: any }) {
    const hitSize = 12;
    this.hitResult = undefined;

    if (!this.helper.getSelectionBoundsShape() || !this.helper.getSelectionBounds()) {
      this.helper.updateSelectionBounds();
    }

    if (!this.helper.getSelectionBoundsShape() || !this.helper.getSelectionBounds()) {
      return undefined;
    }

    // Hit test selection rectangle
    this.hitResult = undefined;
    if (point && !this.helper.getSelectionBounds().contains(point)) {
      this.hitResult = this.helper.getSelectionBoundsShape().hitTest(point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (this.hitResult && this.hitResult.type === 'bounds') {
      // Normalize the direction so that corners are at 45° angles.
      const dir = point.subtract(this.helper.getSelectionBounds().center);
      dir.x /= this.helper.getSelectionBounds().width / 2;
      dir.y /= this.helper.getSelectionBounds().height / 2;
      ToolsUtil.setCanvasRotateCursor(dir, 0);
      this.cursorDir = dir;
      return true;
    }

    return false;
  }
}

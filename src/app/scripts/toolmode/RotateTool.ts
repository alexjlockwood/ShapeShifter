import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

export class RotateTool extends AbstractTool {
  private hitResult: paper.HitResult;
  private cursorDir: paper.Point;

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    let isRotating = false;
    let hasChanged = false;
    let originalAngle = 0;
    let originalCenter: paper.Point;
    let originalContent: SelectionState[];
    let originalShape: string;

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.helper.updateSelectionBounds();
        this.helper.showSelectionBounds();
      },
      deactivate: () => this.helper.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        console.log('mousedown');
        isRotating = false;
        hasChanged = false;
        originalAngle = 0;
        if (this.hitResult) {
          if (this.hitResult.type === 'bounds') {
            originalContent = ToolsUtil.captureSelectionState();
            originalShape = this.helper.getSelectionBoundsShape().exportJSON({ asString: false });
            isRotating = true;
            originalCenter = this.helper.getSelectionBounds().center.clone();
            const delta = event.point.subtract(originalCenter);
            originalAngle = Math.atan2(delta.y, delta.x);
          }
          this.helper.updateSelectionBounds();
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (isRotating && hasChanged) {
          this.helper.clearSelectionBounds();
        }
        this.helper.updateSelectionBounds();
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (isRotating) {
          const delta = event.point.subtract(originalCenter);
          const angle = Math.atan2(delta.y, delta.x);
          let da = angle - originalAngle;

          if (event.modifiers.shift) {
            const snapeAngle = Math.PI / 4;
            da = Math.round(da / snapeAngle) * snapeAngle;
          }

          ToolsUtil.restoreSelectionState(originalContent);

          // TODO: fix this hackiness
          const id = this.helper.getSelectionBoundsShape().id;
          this.helper.getSelectionBoundsShape().importJSON(originalShape);
          this.helper.getSelectionBoundsShape()._id = id;

          const deg = da / Math.PI * 180;

          this.helper.getSelectionBoundsShape().rotate(deg, originalCenter);

          const selected = paper.project.getSelectedItems();
          for (const item of selected) {
            if ((item as any).guide) {
              continue;
            }
            item.rotate(deg, originalCenter);
          }

          ToolsUtil.setCanvasRotateCursor(this.cursorDir, da);
          hasChanged = true;
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
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

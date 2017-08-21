import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { Cursor } from './ToolsUtil';

/**
 * Rotate tool for rotating shapes.
 */
export class RotateTool extends AbstractTool {
  private hitResult: paper.HitResult;
  private cursorDir: paper.Point;

  constructor(private readonly toolState: ToolState) {
    super();

    let isRotating = false;
    let hasRotationChanged = false;
    let originalAngle = 0;
    let originalCenter: paper.Point;
    let originalContent: SelectionState[];
    let originalShape: string;

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor(Cursor.ArrowBlack);
        this.toolState.updateSelectionBounds();
        this.toolState.showSelectionBounds();
      },
      deactivate: () => this.toolState.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        isRotating = false;
        hasRotationChanged = false;
        originalAngle = 0;
        if (this.hitResult) {
          if (this.hitResult.type === 'bounds') {
            originalContent = ToolsUtil.captureSelectionState();
            originalShape = this.toolState.getSelectionBoundsPath().exportJSON({ asString: false });
            isRotating = true;
            originalCenter = this.toolState.getSelectionBounds().center.clone();
            const delta = event.point.subtract(originalCenter);
            originalAngle = Math.atan2(delta.y, delta.x);
          }
          this.toolState.updateSelectionBounds();
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (!isRotating) {
          return;
        }
        const delta = event.point.subtract(originalCenter);
        const angle = Math.atan2(delta.y, delta.x);
        let da = angle - originalAngle;

        if (event.modifiers.shift) {
          const snapAngle = Math.PI * 2 / 8;
          da = Math.round(da / snapAngle) * snapAngle;
        }

        ToolsUtil.restoreSelectionState(originalContent);

        // TODO: missing types
        const id = this.toolState.getSelectionBoundsPath().id;
        this.toolState.getSelectionBoundsPath().importJSON(originalShape);
        (this.toolState.getSelectionBoundsPath() as any)._id = id;

        const deg = da / Math.PI * 180;
        this.toolState.getSelectionBoundsPath().rotate(deg, originalCenter);

        paper.project.getSelectedItems().forEach(item => {
          // TODO: missing types
          if ((item as any).guide) {
            return;
          }
          item.rotate(deg, originalCenter);
        });

        ToolsUtil.setCanvasRotateCursor(this.cursorDir, da);
        hasRotationChanged = true;
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        if (isRotating && hasRotationChanged) {
          this.toolState.clearSelectionBounds();
        }
        this.toolState.updateSelectionBounds();
      },
    });
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
    const hitSize = 12;
    this.hitResult = undefined;

    if (!this.toolState.getSelectionBoundsPath() || !this.toolState.getSelectionBounds()) {
      this.toolState.updateSelectionBounds();
    }

    if (!this.toolState.getSelectionBoundsPath() || !this.toolState.getSelectionBounds()) {
      return false;
    }

    // Hit test selection rectangle
    this.hitResult = undefined;
    if (point && !this.toolState.getSelectionBounds().contains(point)) {
      this.hitResult = this.toolState.getSelectionBoundsPath().hitTest(point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (!this.hitResult || this.hitResult.type !== 'bounds') {
      return false;
    }

    // Normalize the direction so that corners are at 45° angles.
    const dir = point.subtract(this.toolState.getSelectionBounds().center);
    dir.x /= this.toolState.getSelectionBounds().width / 2;
    dir.y /= this.toolState.getSelectionBounds().height / 2;
    ToolsUtil.setCanvasRotateCursor(dir, 0);
    this.cursorDir = dir;
    return true;
  }
}

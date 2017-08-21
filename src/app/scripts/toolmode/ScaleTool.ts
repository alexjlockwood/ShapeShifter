import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

const oppositeCorner = {
  'top-left': 'bottom-right',
  'top-center': 'bottom-center',
  'top-right': 'bottom-left',
  'right-center': 'left-center',
  'bottom-right': 'top-left',
  'bottom-center': 'top-center',
  'bottom-left': 'top-right',
  'left-center': 'right-center',
};

/**
 * Scaling tool for scaling shapes.
 */
export class ScaleTool extends AbstractTool {
  private hitResult: paper.HitResult;

  constructor(private readonly toolState: ToolState) {
    super();

    let isScaling = false;
    let hasScaleChanged = false;
    let originalCenter: paper.Point;
    let originalSize: paper.Point;
    let originalContent: SelectionState[];
    let pivot: paper.Point;
    let corner: paper.Point;

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.toolState.updateSelectionBounds();
        this.toolState.showSelectionBounds();
      },
      deactivate: () => this.toolState.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        isScaling = false;
        hasScaleChanged = false;
        if (!this.hitResult) {
          return;
        }
        if (this.hitResult.type === 'bounds') {
          isScaling = true;
          originalContent = ToolsUtil.captureSelectionState();
          const pivotName = camelize(oppositeCorner[this.hitResult.name]);
          const cornerName = camelize(this.hitResult.name);
          pivot = this.toolState.getSelectionBounds()[pivotName].clone();
          corner = this.toolState.getSelectionBounds()[cornerName].clone();
          originalSize = corner.subtract(pivot);
          originalCenter = this.toolState.getSelectionBounds().center;
        }
        this.toolState.updateSelectionBounds();
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (!isScaling) {
          return;
        }
        let origPivot = pivot;
        let origSize = originalSize;

        if (event.modifiers.option) {
          origPivot = originalCenter;
          origSize = origSize.multiply(0.5);
        }

        corner = corner.add(event.delta);
        const size = corner.subtract(origPivot);
        let sx = 1;
        let sy = 1;
        if (Math.abs(origSize.x) > 1e-6) {
          sx = size.x / origSize.x;
        }
        if (Math.abs(origSize.y) > 1e-6) {
          sy = size.y / origSize.y;
        }

        if (event.modifiers.shift) {
          const signx = sx > 0 ? 1 : -1;
          const signy = sy > 0 ? 1 : -1;
          sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
          sx *= signx;
          sy *= signy;
        }

        ToolsUtil.restoreSelectionState(originalContent);

        paper.project.getSelectedItems().forEach(item => {
          // TODO: missing types
          if ((item as any).guide) {
            return;
          }
          item.scale(sx, sy, origPivot);
        });
        this.toolState.updateSelectionBounds();
        hasScaleChanged = true;
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        if (!isScaling || !hasScaleChanged) {
          return;
        }
        this.toolState.clearSelectionBounds();
      },
    });
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
    const hitSize = 6;
    this.hitResult = undefined;

    if (!this.toolState.getSelectionBoundsPath() || !this.toolState.getSelectionBounds()) {
      this.toolState.updateSelectionBounds();
    }

    if (!this.toolState.getSelectionBoundsPath() || !this.toolState.getSelectionBounds()) {
      return false;
    }

    // Hit test selection rectangle.
    if (point) {
      this.hitResult = this.toolState.getSelectionBoundsPath().hitTest(point, {
        bounds: true,
        guides: true,
        tolerance: hitSize,
      });
    }

    if (!this.hitResult && this.hitResult.type !== 'bounds') {
      return false;
    }

    // Normalize the direction so that corners are at 45° angles.
    const dir = point.subtract(this.toolState.getSelectionBounds().center);
    dir.x /= this.toolState.getSelectionBounds().width / 2;
    dir.y /= this.toolState.getSelectionBounds().height / 2;
    ToolsUtil.setCanvasScaleCursor(dir);
    return true;
  }
}

function camelize(str: string) {
  return str.replace(/-(.)/g, (match, chr) => chr.toUpperCase());
}

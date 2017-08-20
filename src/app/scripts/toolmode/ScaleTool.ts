import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
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

export class ScaleTool extends AbstractTool {
  private hitResult: paper.HitResult;

  constructor(private readonly helper: SelectionBoundsHelper) {
    super();

    let isScaling = false;
    let hasChanged = false;
    let originalCenter: paper.Point;
    let originalSize: paper.Point;
    let originalContent: SelectionState[];
    let pivot: paper.Point;
    let corner: paper.Point;

    this.on({
      activate: () => {
        ToolsUtil.setCanvasCursor('cursor-arrow-black');
        this.helper.updateSelectionBounds();
        this.helper.showSelectionBounds();
      },
      deactivate: () => this.helper.hideSelectionBounds(),
      mousedown: (event: paper.MouseEvent) => {
        isScaling = false;
        hasChanged = false;
        if (!this.hitResult) {
          return;
        }
        if (this.hitResult.type === 'bounds') {
          isScaling = true;
          originalContent = ToolsUtil.captureSelectionState();
          const pivotName = camelize(oppositeCorner[this.hitResult.name]);
          const cornerName = camelize(this.hitResult.name);
          pivot = this.helper.getSelectionBounds()[pivotName].clone();
          corner = this.helper.getSelectionBounds()[cornerName].clone();
          originalSize = corner.subtract(pivot);
          originalCenter = this.helper.getSelectionBounds().center;
        }
        this.helper.updateSelectionBounds();
      },
      mouseup: (event: paper.MouseEvent) => {
        if (!isScaling || !hasChanged) {
          return;
        }
        this.helper.clearSelectionBounds();
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
        console.log(corner, size, origSize, sx, sy);

        if (event.modifiers.shift) {
          const signx = sx > 0 ? 1 : -1;
          const signy = sy > 0 ? 1 : -1;
          sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
          sx *= signx;
          sy *= signy;
        }

        ToolsUtil.restoreSelectionState(originalContent);

        const selected = paper.project.getSelectedItems();
        for (const item of selected) {
          if ((item as any).guide) {
            continue;
          }
          item.scale(sx, sy, origPivot);
        }
        this.helper.updateSelectionBounds();
        hasChanged = true;
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
    });
  }

  // @Override
  protected hitTest({ point }: HitTestArgs) {
    const hitSize = 6;
    this.hitResult = undefined;

    if (!this.helper.getSelectionBoundsShape() || !this.helper.getSelectionBounds()) {
      this.helper.updateSelectionBounds();
    }

    if (!this.helper.getSelectionBoundsShape() || !this.helper.getSelectionBounds()) {
      return undefined;
    }

    // Hit test selection rectangle.
    if (point) {
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
      ToolsUtil.setCanvasScaleCursor(dir);
      return true;
    }

    return false;
  }
}

function camelize(str: string) {
  return str.replace(/-(.)/g, (match, chr) => chr.toUpperCase());
}

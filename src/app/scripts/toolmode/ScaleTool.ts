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
  private mouseStartPos = new paper.Point(0, 0);
  private mode: string;
  private hitResult: paper.HitResult;
  private pivot: paper.Point;
  private corner: paper.Point;
  private originalCenter: paper.Point;
  private originalSize: paper.Point;
  private originalContent: SelectionState[];
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
            this.mode = 'scale';
            const pivotName = (paper as any).Base.camelize(oppositeCorner[this.hitResult.name]);
            const cornerName = (paper as any).Base.camelize(this.hitResult.name);
            this.pivot = this.helper.getSelectionBounds()[pivotName].clone();
            this.corner = this.helper.getSelectionBounds()[cornerName].clone();
            this.originalSize = this.corner.subtract(this.pivot);
            this.originalCenter = this.helper.getSelectionBounds().center;
          }
          this.helper.updateSelectionBounds();
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === 'scale') {
          if (this.changed) {
            this.helper.clearSelectionBounds();
            // undo.snapshot('Scale Shapes');
          }
        }
      },
      mousedrag: (event: paper.MouseEvent) => {
        if (this.mode === 'scale') {
          let pivot = this.pivot;
          let originalSize = this.originalSize;

          if (event.modifiers.option) {
            pivot = this.originalCenter;
            originalSize = originalSize.multiply(0.5);
          }

          this.corner = this.corner.add(event.delta);
          const size = this.corner.subtract(pivot);
          let sx = 1;
          let sy = 1;
          if (Math.abs(originalSize.x) > 0.0000001) {
            sx = size.x / originalSize.x;
          }
          if (Math.abs(originalSize.y) > 0.0000001) {
            sy = size.y / originalSize.y;
          }

          if (event.modifiers.shift) {
            const signx = sx > 0 ? 1 : -1;
            const signy = sy > 0 ? 1 : -1;
            sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
            sx *= signx;
            sy *= signy;
          }

          ToolsUtil.restoreSelectionState(this.originalContent);

          const selected = paper.project.getSelectedItems();
          for (const item of selected) {
            if ((item as any).guide) {
              continue;
            }
            item.scale(sx, sy, pivot);
          }
          this.helper.updateSelectionBounds();
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

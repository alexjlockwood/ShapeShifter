import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import { DirectSelectTool } from './DirectSelectTool';
import { PenTool } from './PenTool';
import { RotateTool } from './RotateTool';
import { ScaleTool } from './ScaleTool';
import { SelectTool } from './SelectTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher implements SelectionBoundsHelper {
  private readonly tool = new paper.Tool();
  private readonly toolStack: ReadonlyArray<AbstractTool>;
  private mode: ToolMode;
  private hotTool: AbstractTool;
  private activeTool: AbstractTool;
  private lastPoint = new paper.Point(0, 0);
  private selectionBounds = undefined;
  private selectionBoundsShape = undefined;
  private drawSelectionBounds = 0;

  constructor() {
    this.toolStack = [
      new ZoomPanTool(),
      new PenTool(this),
      new ScaleTool(this),
      new RotateTool(this),
      new DirectSelectTool(this),
      new SelectTool(this),
    ];
    this.tool.on({
      activate: () => (this.activeTool = this.hotTool = undefined),
      deactivate: () => (this.activeTool = this.hotTool = undefined),
      mousedown: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        if (this.hotTool) {
          this.activeTool = this.hotTool;
          this.activeTool.fire('mousedown', event);
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        if (this.activeTool) {
          this.activeTool.fire('mouseup', event);
        }
        this.activeTool = undefined;
        this.fire('mouseup', event);
      },
      mousedrag: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        if (this.activeTool) {
          this.activeTool.fire('mousedrag', event);
        }
      },
      mousemove: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        this.fire('mousemove', event);
      },
      keydown: (event: paper.KeyEvent) => {
        const point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keydown', { ...event, point });
        } else {
          this.fire('keydown', { point, modifiers: event.modifiers, key: event.key });
        }
      },
      keyup: (event: paper.KeyEvent) => {
        const point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keyup', { ...event, point });
        } else {
          this.fire('keyup', { point, modifiers: event.modifiers, key: event.key });
        }
      },
    });
  }

  private fire(type: FireType, { point, modifiers = {}, key = '' }: HitTestArgs) {
    const prevHotTool = this.hotTool;
    this.hotTool = undefined;

    // Pick the first hot tool.
    for (const tool of this.toolStack) {
      if (tool.dispatchHitTest(type, { point, modifiers, key }, this.mode)) {
        // Use the first tool that handles the event.
        this.hotTool = tool;
        break;
      }
    }
    if (prevHotTool !== this.hotTool) {
      if (prevHotTool) {
        // Deactivate the previous tool.
        prevHotTool.fire('deactivate', undefined);
      }
      if (this.hotTool) {
        // Activate the new tool.
        this.hotTool.fire('activate', undefined);
      }
    }
  }

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode: ToolMode) {
    this.mode = mode;
    this.fire('mode', { point: this.lastPoint.clone() });
  }

  getSelectionBounds() {
    return this.selectionBounds;
  }

  setSelectionBounds(selectionBounds) {
    this.selectionBounds = selectionBounds;
  }

  getSelectionBoundsShape() {
    return this.selectionBoundsShape;
  }

  setSelectionBoundsShape(selectionBoundsShape) {
    this.selectionBoundsShape = selectionBoundsShape;
  }

  getDrawSelectionBounds() {
    return this.drawSelectionBounds;
  }

  setDrawSelectionBounds(drawSelectionBounds: number) {
    this.drawSelectionBounds = drawSelectionBounds;
  }

  showSelectionBounds() {
    this.drawSelectionBounds++;
    if (this.drawSelectionBounds > 0) {
      if (this.selectionBoundsShape) {
        this.selectionBoundsShape.visible = true;
      }
    }
  }

  hideSelectionBounds() {
    if (this.drawSelectionBounds > 0) {
      this.drawSelectionBounds--;
    }
    if (this.drawSelectionBounds === 0) {
      if (this.selectionBoundsShape) {
        this.selectionBoundsShape.visible = false;
      }
    }
  }

  updateSelectionBounds() {
    this.clearSelectionBounds();
    this.selectionBounds = ToolsUtil.getSelectionBounds();
    if (this.selectionBounds) {
      const rect = new paper.Path.Rectangle(this.selectionBounds);
      // var color = paper.project.activeLayer.getSelectedColor();
      rect.strokeColor = 'rgba(0,0,0,0)'; // color ? color : '#009dec';
      rect.strokeWidth = 1 / paper.view.zoom;
      // rect._boundsSelected = true;
      rect.selected = true;
      (rect as any).setFullySelected(true);
      (rect as any).guide = true;
      rect.visible = this.drawSelectionBounds > 0;
      // rect.transformContent = false;
      this.selectionBoundsShape = rect;
    }
  }

  clearSelectionBounds() {
    if (this.selectionBoundsShape) {
      this.selectionBoundsShape.remove();
    }
    this.selectionBoundsShape = undefined;
    this.selectionBounds = undefined;
  }
}

type FireType = 'mode' | 'mousedown' | 'mousemove' | 'mouseup' | 'keydown' | 'keyup';

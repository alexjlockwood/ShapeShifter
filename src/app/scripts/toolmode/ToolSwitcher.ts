import { ToolMode } from 'app/model/toolMode';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import { DirectSelectTool } from './DirectSelectTool';
import { PenTool } from './PenTool';
import { RotateTool } from './RotateTool';
import { ScaleTool } from './ScaleTool';
import { SelectTool } from './SelectTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher implements SelectionBoundsHelper {
  private readonly tool = new paper.Tool();
  private readonly toolStack: ReadonlyArray<AbstractTool>;
  private mode: string;
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
        this.testHot('mouseup', event);
      },
      mousedrag: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        if (this.activeTool) {
          this.activeTool.fire('mousedrag', event);
        }
      },
      mousemove: (event: paper.MouseEvent) => {
        this.lastPoint = event.point.clone();
        this.testHot('mousemove', event);
      },
      keydown: (event: paper.KeyEvent) => {
        const point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keydown', event);
        } else {
          this.testHot('keydown', { point, modifiers: event.modifiers || {} });
        }
      },
      keyup: (event: paper.KeyEvent) => {
        const point = this.lastPoint.clone();
        if (this.activeTool) {
          this.activeTool.fire('keyup', event);
        } else {
          this.testHot('keyup', { point, modifiers: event.modifiers || {} });
        }
      },
    });
  }

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode: string) {
    this.mode = mode;
    this.testHot('mode', { point: this.lastPoint.clone() });
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

  private testHot(type: string, event: HitTestArgs) {
    const prev = this.hotTool;
    this.hotTool = undefined;
    // Pick the first hot tool.
    for (const s of this.toolStack) {
      if (s.dispatchHitTest(type, event, this.mode)) {
        this.hotTool = s;
        break;
      }
    }
    if (prev !== this.hotTool) {
      if (prev) {
        prev.fire('deactivate', undefined);
      }
      if (this.hotTool) {
        this.hotTool.fire('activate', undefined);
      }
    }
  }
}

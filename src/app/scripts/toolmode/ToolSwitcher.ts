import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { DirectSelectTool } from './DirectSelectTool';
import { PenTool } from './PenTool';
import { RotateTool } from './RotateTool';
import { ScaleTool } from './ScaleTool';
import { SelectTool } from './SelectTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher {
  private readonly tool = new paper.Tool();
  private readonly toolDelegates: ReadonlyArray<AbstractTool>;
  private readonly toolState = new ToolStateImpl();
  private hotTool: AbstractTool;
  private lastMousePoint = new paper.Point(0, 0);

  constructor() {
    this.toolDelegates = [
      new ZoomPanTool(),
      new PenTool(this.toolState),
      new ScaleTool(this.toolState),
      new RotateTool(this.toolState),
      new DirectSelectTool(this.toolState),
      new SelectTool(this.toolState),
    ];

    // Keep a reference to the tool we will be using throughout the gesture.
    let activeTool: AbstractTool;

    this.tool.on({
      // TODO: figure out how activating/deactivating the tool switcher works?
      activate: () => (this.hotTool = activeTool = undefined),
      deactivate: () => (this.hotTool = activeTool = undefined),
      mousedown: (event: paper.MouseEvent) => {
        this.lastMousePoint = event.point.clone();
        if (this.hotTool) {
          activeTool = this.hotTool;
          activeTool.fire('mousedown', event);
        } else {
          this.fire('mousedown', event);
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        this.lastMousePoint = event.point.clone();
        if (activeTool) {
          activeTool.fire('mouseup', event);
        }
        activeTool = undefined;
        this.fire('mouseup', event);
      },
      mousedrag: (event: paper.MouseEvent) => {
        this.lastMousePoint = event.point.clone();
        if (activeTool) {
          activeTool.fire('mousedrag', event);
        }
      },
      mousemove: (event: paper.MouseEvent) => {
        this.lastMousePoint = event.point.clone();
        this.fire('mousemove', event);
      },
      keydown: (event: paper.KeyEvent) => {
        const point = this.lastMousePoint.clone();
        if (activeTool) {
          activeTool.fire('keydown', { ...event, point });
        } else {
          const { modifiers, key } = event;
          this.fire('keydown', { point, modifiers, key });
        }
      },
      keyup: (event: paper.KeyEvent) => {
        const point = this.lastMousePoint.clone();
        if (activeTool) {
          activeTool.fire('keyup', { ...event, point });
        } else {
          const { modifiers, key } = event;
          this.fire('keyup', { point, modifiers, key });
        }
      },
    });
  }

  private fire(type: FireType, { point, modifiers = {}, key = '' }: HitTestArgs) {
    const prevHotTool = this.hotTool;
    this.hotTool = undefined;

    // Pick the first hot tool.
    for (const tool of this.toolDelegates) {
      if (tool.dispatchHitTest(type, { point, modifiers, key }, this.getToolMode())) {
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
    return this.toolState.getToolMode();
  }

  setToolMode(mode: ToolMode) {
    this.toolState.setToolMode(mode);
    // TODO: improve this API ('switchmode' is meaningless)
    this.fire('switchmode', { point: this.lastMousePoint.clone() });
  }

  setFillColor(fillColor: string) {
    this.toolState.setFillColor(fillColor);

    // TODO: can any other types of items be included?
    const items = paper.project
      .getSelectedItems()
      .filter(item => item instanceof paper.PathItem) as paper.PathItem[];
    for (const item of items) {
      // TODO: only set valid colors on the path items
      item.fillColor = fillColor;
    }
  }

  setStrokeColor(strokeColor: string) {
    this.toolState.setStrokeColor(strokeColor);

    // TODO: can any other types of items be included?
    const items = paper.project
      .getSelectedItems()
      .filter(item => item instanceof paper.PathItem) as paper.PathItem[];
    for (const item of items) {
      // TODO: only set valid colors on the path items
      item.strokeColor = strokeColor;
    }
  }
}

class ToolStateImpl implements ToolState {
  private mode: ToolMode;
  private selectionBounds: paper.Rectangle;
  private selectionBoundsPath: paper.Path.Rectangle;
  private numSelections = 0;

  // TODO: fetch this directly from the store instead of storing a cached value here?
  private fillColor: string;
  private strokeColor: string;

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode: ToolMode) {
    this.mode = mode;
  }

  getSelectionBounds() {
    return this.selectionBounds;
  }

  getSelectionBoundsPath() {
    return this.selectionBoundsPath;
  }

  getFillColor() {
    return this.fillColor;
  }

  setFillColor(fillColor: string) {
    this.fillColor = fillColor;
  }

  getStrokeColor() {
    return this.strokeColor;
  }

  setStrokeColor(strokeColor: string) {
    this.strokeColor = strokeColor;
  }

  // TODO: figure out what this is used for
  showSelectionBounds() {
    this.numSelections++;
    if (this.selectionBoundsPath) {
      this.selectionBoundsPath.visible = true;
    }
  }

  // TODO: figure out what this is used for
  hideSelectionBounds() {
    this.numSelections = Math.max(0, this.numSelections - 1);
    if (this.selectionBoundsPath && this.numSelections === 0) {
      this.selectionBoundsPath.visible = false;
    }
  }

  updateSelectionBounds() {
    this.clearSelectionBounds();
    this.selectionBounds = ToolsUtil.getSelectionBounds();
    if (!this.selectionBounds) {
      return;
    }
    const rect = new paper.Path.Rectangle(this.selectionBounds);
    rect.strokeColor = 'rgba(0,0,0,0)';
    rect.strokeWidth = 1 / paper.view.zoom;
    rect.selected = true;
    rect.setFullySelected(true);
    rect.guide = true;
    rect.visible = this.numSelections > 0;
    this.selectionBoundsPath = rect;
  }

  // TODO: should we set numSelections to 0 here?
  // doing so makes rotate/scale stop working after the first selection
  clearSelectionBounds() {
    this.selectionBounds = undefined;
    if (this.selectionBoundsPath) {
      this.selectionBoundsPath.remove();
      this.selectionBoundsPath = undefined;
    }
  }
}

type FireType = 'switchmode' | 'mousedown' | 'mousemove' | 'mouseup' | 'keydown' | 'keyup';

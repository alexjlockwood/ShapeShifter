import { ToolMode } from 'app/model/paper';
import * as $ from 'jquery';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { PenTool } from './PenTool';
import { SelectionTool } from './SelectionTool';
import { ZoomPanTool } from './ZoomPanTool';

/**
 * The entry class used for switching between different tool types.
 *
 * TODO: figure out how to deal with right mouse clicks in each tool
 */
export class ToolSwitcher {
  private readonly tools: ReadonlyArray<BaseTool> = [
    new ZoomPanTool(),
    // new PenTool(),
    new SelectionTool(),
  ];
  private readonly masterTool = new paper.Tool();
  private currentToolMode: ToolMode;
  private currentTool: BaseTool;

  constructor() {
    const processEventFn = (event: paper.ToolEvent | paper.KeyEvent) => this.processEvent(event);
    this.masterTool.on({
      mousedown: processEventFn,
      mousedrag: processEventFn,
      mousemove: processEventFn,
      mouseup: processEventFn,
      keydown: processEventFn,
      keyup: processEventFn,
    });
  }

  setToolMode(toolMode: ToolMode) {
    if (this.currentToolMode === toolMode) {
      return;
    }
    this.currentToolMode = toolMode;
    this.processEvent();
  }

  private processEvent(event?: paper.ToolEvent | paper.KeyEvent) {
    const prevTool = this.currentTool;
    this.currentTool = undefined;
    for (const tool of this.tools) {
      if (tool.dispatchInterceptEvent(this.currentToolMode, event)) {
        this.currentTool = tool;
        break;
      }
    }
    if (prevTool !== this.currentTool) {
      if (prevTool) {
        prevTool.dispatchDeactivate();
      }
      if (this.currentTool) {
        this.currentTool.dispatchActivate();
      }
    }
    if (this.currentTool) {
      if (event instanceof paper.ToolEvent || event instanceof paper.KeyEvent) {
        this.currentTool.dispatchEvent(event);
      } else {
        this.currentTool.dispatchToolModeChanged(this.currentToolMode);
      }
    }
  }
}

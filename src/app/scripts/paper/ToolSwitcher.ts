import { ToolMode } from 'app/model/paper';
import * as $ from 'jquery';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { PenTool } from './PenTool';
import { SelectionTool } from './SelectionTool';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher {
  private readonly tools: ReadonlyArray<BaseTool> = [
    new ZoomPanTool(),
    new PenTool(),
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
      const mode = this.currentToolMode;
      if (tool.dispatchInterceptEvent(mode, event)) {
        console.log(this.currentTool);
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
      this.currentTool.dispatchEvent(event);
    }
  }
}

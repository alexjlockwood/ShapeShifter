import { ToolMode } from 'app/model/paper';
import * as $ from 'jquery';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { SelectionTool } from './SelectionTool';
import { ZoomPanTool } from './ZoomPanTool';

export class ToolSwitcher {
  private readonly tools: ReadonlyArray<BaseTool>;
  private readonly masterTool = new paper.Tool();
  private currentToolMode: ToolMode;
  private currentTool: BaseTool;

  constructor() {
    this.tools = [new ZoomPanTool() as BaseTool];
    this.masterTool.on({
      mousedown: (event: paper.ToolEvent) => this.processMouseEvent(event),
      mousedrag: (event: paper.ToolEvent) => this.processMouseEvent(event),
      mousemove: (event: paper.ToolEvent) => this.processMouseEvent(event),
      mouseup: (event: paper.ToolEvent) => this.processMouseEvent(event),
      keydown: (event: paper.KeyEvent) => this.processKeyEvent(event),
      keyup: (event: paper.KeyEvent) => this.processKeyEvent(event),
    });
  }

  private processToolModeEvent() {
    const prevTool = this.currentTool;
    this.currentTool = undefined;
    for (const tool of this.tools) {
      if (tool.shouldInterceptToolModeEvent(this.currentToolMode)) {
        this.currentTool = tool;
        break;
      }
    }
    this.switchTools(prevTool, this.currentTool);
    if (this.currentTool) {
      this.currentTool.onToolModeEvent(this.currentToolMode);
    }
  }

  private processMouseEvent(mouseEvent: paper.ToolEvent) {
    console.log('processMouseEvent');
    const prevTool = this.currentTool;
    this.currentTool = undefined;
    for (const tool of this.tools) {
      if (tool.shouldInterceptMouseEvent(this.currentToolMode, mouseEvent)) {
        this.currentTool = tool;
        break;
      }
    }
    this.switchTools(prevTool, this.currentTool);
    if (this.currentTool) {
      this.currentTool.dispatchMouseEvent(mouseEvent);
    }
  }

  private processKeyEvent(keyEvent: paper.KeyEvent) {
    const prevTool = this.currentTool;
    this.currentTool = undefined;
    for (const tool of this.tools) {
      if (tool.shouldInterceptKeyEvent(this.currentToolMode, keyEvent)) {
        this.currentTool = tool;
        break;
      }
    }
    this.switchTools(prevTool, this.currentTool);
    if (this.currentTool) {
      this.currentTool.dispatchKeyEvent(keyEvent);
    }
  }

  private switchTools(prevTool: BaseTool, currTool: BaseTool) {
    if (prevTool !== this.currentTool) {
      if (prevTool) {
        prevTool.onDeactivate();
      }
      if (currTool) {
        currTool.onActivate();
      }
    }
  }

  setToolMode(toolMode: ToolMode) {
    if (this.currentToolMode === toolMode) {
      return;
    }
    this.currentToolMode = toolMode;
    this.processToolModeEvent();
  }
}

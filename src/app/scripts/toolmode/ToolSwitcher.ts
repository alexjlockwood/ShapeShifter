import { ToolMode } from 'app/model/toolmode';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import { DetailSelectTool } from './DetailSelectTool';
import { PenTool } from './PenTool';
import { SelectTool } from './SelectTool';

export class ToolSwitcher {
  private readonly tools = new Map<ToolMode, AbstractTool>([
    [ToolMode.Select, new SelectTool()],
    [ToolMode.DetailSelect, new DetailSelectTool()],
    [ToolMode.Pen, new PenTool()],
  ]);
  private activeToolMode: ToolMode;

  private get activeTool() {
    return this.tools.get(this.activeToolMode);
  }

  setToolMode(toolMode: ToolMode) {
    if (this.activeToolMode === toolMode) {
      return;
    }
    this.activeToolMode = toolMode;
    this.activeTool.activate();
  }
}

import { ToolMode } from 'app/model/toolmode';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import { DetailSelectionTool } from './DetailSelectionTool';
import { PenTool } from './PenTool';
import { SelectionTool } from './SelectionTool';

export class ToolSwitcher {
  private readonly tools = new Map<ToolMode, AbstractTool>([
    [ToolMode.Selection, new SelectionTool()],
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

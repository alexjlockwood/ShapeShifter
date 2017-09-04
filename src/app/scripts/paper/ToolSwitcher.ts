import { ToolMode } from 'app/model/paper';
import { State, Store } from 'app/store';
import { getToolMode } from 'app/store/toolmode/selectors';
import * as paper from 'paper';
import { OutputSelector } from 'reselect';

import { MasterTool, Tool, ZoomPanTool } from './tool';

/**
 * The entry class used for switching between different tool types.
 *
 * TODO: figure out how to deal with right mouse clicks in each tool
 */
export class ToolSwitcher {
  private readonly paperTool = new paper.Tool();
  private readonly masterTool: Tool;
  private readonly zoomPanTool: Tool;
  private currentTool: Tool;

  constructor(private readonly store: Store<State>) {
    const processEventFn = (event: paper.ToolEvent | paper.KeyEvent) => {
      this.processEvent(event);
    };
    this.paperTool.on({
      mousedown: processEventFn,
      mousedrag: processEventFn,
      mousemove: processEventFn,
      mouseup: processEventFn,
      keydown: processEventFn,
      keyup: processEventFn,
    });
    this.masterTool = new MasterTool(store);
    this.zoomPanTool = new ZoomPanTool(store);
    store.select(getToolMode).subscribe(toolMode => this.setToolMode(toolMode));
  }

  private setToolMode(toolMode: ToolMode) {
    // TODO: clean this fixed distance code up?
    this.paperTool.fixedDistance = toolMode === ToolMode.Pencil ? 4 : undefined;
    this.processEvent();
  }

  private getToolMode() {
    let toolMode: ToolMode;
    this.store
      .select(getToolMode)
      .first()
      .subscribe(tm => (toolMode = tm));
    return toolMode;
  }

  private processEvent(event?: paper.ToolEvent | paper.KeyEvent) {
    const prevTool = this.currentTool;
    const currentToolMode = this.getToolMode();
    this.currentTool =
      currentToolMode === ToolMode.ZoomPan || (event && event.modifiers.space)
        ? this.zoomPanTool
        : this.masterTool;
    if (prevTool !== this.currentTool) {
      if (prevTool) {
        prevTool.onDeactivate();
      }
      if (this.currentTool) {
        this.currentTool.onActivate();
      }
    }
    if (this.currentTool) {
      if (event instanceof paper.ToolEvent) {
        this.currentTool.onMouseEvent(event);
      } else if (event instanceof paper.KeyEvent) {
        this.currentTool.onKeyEvent(event);
      } else {
        this.currentTool.onToolModeChanged(currentToolMode);
      }
    }
  }
}

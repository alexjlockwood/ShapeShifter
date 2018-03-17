import { ToolMode } from 'app/model/paper';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { GestureTool } from './GestureTool';
import { Tool } from './Tool';
import { ZoomPanTool } from './ZoomPanTool';

/**
 * The master tool that is in charge of dispatching mouse, key,
 * and toolmode change events.
 */
export class MasterToolDelegate {
  private readonly paperTool = new paper.Tool();
  private readonly onEventFn: (event?: paper.ToolEvent | paper.KeyEvent) => void;

  constructor(private readonly ps: PaperService) {
    const gestureTool = new GestureTool(ps);
    const zoomPanTool = new ZoomPanTool(ps);
    let currentTool: Tool;

    const onEventFn = (event?: paper.ToolEvent | paper.KeyEvent) => {
      const toolMode = ps.getToolMode();
      const prevTool = currentTool;
      currentTool =
        toolMode === ToolMode.ZoomPan || (event && event.modifiers.space)
          ? zoomPanTool
          : gestureTool;
      if (prevTool !== currentTool) {
        if (prevTool) {
          prevTool.onDeactivate();
        }
        currentTool.onActivate();
      }
      if (event instanceof paper.ToolEvent) {
        currentTool.onToolEvent(event);
      } else if (event instanceof paper.KeyEvent) {
        currentTool.onKeyEvent(event);
      } else {
        currentTool.onToolModeChanged();
      }
    };

    this.paperTool.on({
      mousedown: onEventFn,
      mousedrag: onEventFn,
      mousemove: onEventFn,
      mouseup: onEventFn,
      keydown: onEventFn,
      keyup: onEventFn,
    });
    this.onEventFn = onEventFn;
  }

  onToolModeChanged() {
    const toolMode = this.ps.getToolMode();
    // TODO: better way to set this?
    this.paperTool.fixedDistance = toolMode === ToolMode.Pencil ? 4 : undefined;
    this.onEventFn();
  }
}

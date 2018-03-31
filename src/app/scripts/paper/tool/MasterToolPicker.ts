import { ToolMode } from 'app/model/paper';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { GestureTool } from './GestureTool';
import { Tool } from './Tool';
import { ZoomPanTool } from './ZoomPanTool';

/**
 * The master tool that is in charge of dispatching mouse, key,
 * and tool mode change events.
 */
export class MasterToolPicker {
  private readonly paperTool = new paper.Tool();

  constructor(private readonly ps: PaperService) {
    const gestureTool = new GestureTool(ps);
    const zoomPanTool = new ZoomPanTool(ps);
    let currentTool: Tool;

    const onEventFn = (event: paper.ToolEvent | paper.KeyEvent) => {
      const prevTool = currentTool;
      currentTool =
        this.ps.getToolMode() === ToolMode.ZoomPan || (event && event.modifiers.space)
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
      } else {
        currentTool.onKeyEvent(event);
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
  }

  onToolModeChanged() {
    // TODO: better way to set this?
    this.paperTool.fixedDistance = this.ps.getToolMode() === ToolMode.Pencil ? 4 : undefined;
  }
}

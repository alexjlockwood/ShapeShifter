import * as paper from 'paper';

import { ToolMode } from './ToolMode';

export abstract class AbstractTool extends paper.Tool {
  dispatchHitTest(type: string, event: HitTestArgs, mode: string) {
    return this.hitTest(event);
  }
  protected abstract hitTest(args: HitTestArgs): boolean;
}

export interface HitTestArgs {
  point?: paper.Point;
  modifiers?: any;
  key?: string;
}

export interface SelectionBoundsHelper {
  getSelectionBounds: Function;
  getSelectionBoundsPath: Function;
  showSelectionBounds: Function;
  hideSelectionBounds: Function;
  clearSelectionBounds: Function;
  updateSelectionBounds: Function;
  getToolMode(): ToolMode;
}

import * as paper from 'paper';

import { ToolMode } from './ToolMode';

export abstract class AbstractTool extends paper.Tool {
  dispatchHitTest(type: string, event: HitTestArgs, toolMode: ToolMode) {
    return this.hitTest(event);
  }
  protected abstract hitTest(args: HitTestArgs): boolean;
}

export interface HitTestArgs {
  point?: paper.Point;
  modifiers?: any;
  key?: string;
}

export interface ToolState {
  getSelectionBounds(): paper.Rectangle;
  getSelectionBoundsPath(): paper.Path.Rectangle;
  showSelectionBounds(): void;
  hideSelectionBounds(): void;
  clearSelectionBounds(): void;
  updateSelectionBounds(): void;
  getToolMode(): ToolMode;
}

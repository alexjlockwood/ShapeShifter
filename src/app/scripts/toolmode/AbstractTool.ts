import * as paper from 'paper';

export abstract class AbstractTool extends paper.Tool {
  dispatchHitTest(type: string, event: HitTestArgs, mode: string) {
    return this.hitTest(event);
  }
  protected abstract hitTest(args: HitTestArgs): boolean;
}

export interface HitTestArgs {
  point?: paper.Point;
  modifiers?: any;
}

export interface SelectionBoundsHelper {
  setSelectionBounds: Function;
  getSelectionBounds: Function;
  setSelectionBoundsShape: Function;
  getSelectionBoundsShape: Function;
  setDrawSelectionBounds: Function;
  getDrawSelectionBounds: Function;
  showSelectionBounds: Function;
  hideSelectionBounds: Function;
  clearSelectionBounds: Function;
  updateSelectionBounds: Function;
  getToolMode(): string;
}

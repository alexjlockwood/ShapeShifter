import * as paper from 'paper';

export abstract class AbstractTool extends paper.Tool {
  abstract testHot(type: string, event: HitTestArgs, mode: string): boolean;
}

export interface HitTestArgs {
  point: paper.Point;
  modifiers?: Object;
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

import { Action } from '@ngrx/store';
import { ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

export const SET_TOOL_MODE = '__paper__SET_TOOL_MODE';
export const SET_FILL_COLOR = '__paper__SET_FILL_COLOR';
export const SET_STROKE_COLOR = '__paper__SET_STROKE_COLOR';
export const SET_SELECTION_BOX = '__paper__SET_SELECTION_BOX';
export const SET_PATH_PREVIEW = '__paper__SET_PATH_PREVIEW';

export class SetToolMode implements Action {
  readonly type = SET_TOOL_MODE;
  readonly payload: { toolMode: ToolMode };
  constructor(toolMode: ToolMode) {
    this.payload = { toolMode };
  }
}

export class SetFillColor implements Action {
  readonly type = SET_FILL_COLOR;
  readonly payload: { fillColor: string };
  constructor(fillColor: string) {
    this.payload = { fillColor };
  }
}

export class SetStrokeColor implements Action {
  readonly type = SET_STROKE_COLOR;
  readonly payload: { strokeColor: string };
  constructor(strokeColor: string) {
    this.payload = { strokeColor };
  }
}

export class SetSelectionBox implements Action {
  readonly type = SET_SELECTION_BOX;
  readonly payload: { selectionBox: { from: Point; to: Point } };
  constructor(selectionBox?: { from: Point; to: Point }) {
    this.payload = { selectionBox };
  }
}

export class SetPathPreview implements Action {
  readonly type = SET_PATH_PREVIEW;
  readonly payload: { pathData: string };
  constructor(pathData: string) {
    this.payload = { pathData };
  }
}

export type Actions =
  | SetToolMode
  | SetFillColor
  | SetStrokeColor
  | SetSelectionBox
  | SetPathPreview;

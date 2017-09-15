import { Action } from '@ngrx/store';
import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

export const SET_TOOL_MODE = '__paper__SET_TOOL_MODE';
export const SET_SELECTION_BOX = '__paper__SET_SELECTION_BOX';
export const SET_PATH_PREVIEW = '__paper__SET_PATH_PREVIEW';
export const SET_FOCUSED_EDIT_PATH = '__paper__SET_FOCUSED_EDIT_PATH';
export const SET_CANVAS_CURSOR = '__paper__SET_CANVAS_CURSOR';

export class SetToolMode implements Action {
  readonly type = SET_TOOL_MODE;
  readonly payload: { toolMode: ToolMode };
  constructor(toolMode: ToolMode) {
    this.payload = { toolMode };
  }
}

export class SetSelectionBox implements Action {
  readonly type = SET_SELECTION_BOX;
  readonly payload: { selectionBox: { from: Point; to: Point } };
  constructor(selectionBox: { from: Point; to: Point } | undefined) {
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

export interface FocusedEditPath {
  readonly layerId: string;
  readonly selectedSegments: ReadonlySet<number>;
  readonly visibleHandleIns: ReadonlySet<number>;
  readonly selectedHandleIns: ReadonlySet<number>;
  readonly visibleHandleOuts: ReadonlySet<number>;
  readonly selectedHandleOuts: ReadonlySet<number>;
}

export class SetFocusedEditPath implements Action {
  readonly type = SET_FOCUSED_EDIT_PATH;
  readonly payload: { focusedEditPath: FocusedEditPath };
  constructor(focusedEditPath: FocusedEditPath) {
    this.payload = { focusedEditPath };
  }
}

export class SetCanvasCursor implements Action {
  readonly type = SET_CANVAS_CURSOR;
  readonly payload: { canvasCursor: CanvasCursor };
  constructor(canvasCursor: CanvasCursor) {
    this.payload = { canvasCursor };
  }
}

export type Actions =
  | SetToolMode
  | SetSelectionBox
  | SetPathPreview
  | SetFocusedEditPath
  | SetCanvasCursor;

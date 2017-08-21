import { Action } from '@ngrx/store';
import { ToolMode } from 'app/model/toolmode';

export const SET_TOOL_MODE = '__toolmode__SET_TOOL_MODE';
export const SET_FILL_COLOR = '__toolmode__SET_FILL_COLOR';
export const SET_STROKE_COLOR = '__toolmode__SET_STROKE_COLOR';

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

export type Actions = SetToolMode | SetFillColor | SetStrokeColor;

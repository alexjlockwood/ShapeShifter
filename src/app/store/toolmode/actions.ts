import { Action } from '@ngrx/store';
import { ToolMode } from 'app/model/toolmode';

export const SET_TOOL_MODE = '__toolmode__SET_TOOL_MODE';

export class SetToolMode implements Action {
  readonly type = SET_TOOL_MODE;
  readonly payload: { toolMode: ToolMode };
  constructor(toolMode: ToolMode) {
    this.payload = { toolMode };
  }
}

export type Actions = SetToolMode;

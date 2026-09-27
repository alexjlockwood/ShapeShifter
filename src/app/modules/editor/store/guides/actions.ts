import type { Guide } from 'app/modules/editor/model/guides';
import { Action } from 'app/modules/editor/store';

export enum GuideActionTypes {
  SetGuides = '__guides__SET_GUIDES',
}

export class SetGuides implements Action {
  readonly type = GuideActionTypes.SetGuides;
  readonly payload: { guides: ReadonlyArray<Guide> };
  constructor(guides: ReadonlyArray<Guide>) {
    this.payload = { guides };
  }
}

export type GuideActions = SetGuides;

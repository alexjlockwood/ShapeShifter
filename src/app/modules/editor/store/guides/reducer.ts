import type { Guide } from 'app/modules/editor/model/guides';

import { GuideActions, GuideActionTypes } from './actions';

export interface State {
  /** The canvas editor's guides, which are saved with the project (model/guides). */
  readonly guides: ReadonlyArray<Guide>;
}

export function buildInitialState(): State {
  return { guides: [] };
}

export function reducer(state = buildInitialState(), action: GuideActions): State {
  switch (action.type) {
    case GuideActionTypes.SetGuides:
      return { ...state, guides: action.payload.guides };
  }
  return state;
}

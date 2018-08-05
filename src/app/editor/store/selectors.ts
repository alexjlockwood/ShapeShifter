import * as _ from 'lodash';
import { createSelector, createSelectorCreator, defaultMemoize } from 'reselect';

import { State } from './reducer';

// TODO: fix these typings... reorganize ngrx store code
const getState = (state: State): State => (state as any).editor;
export const getEditorState = createSelector(getState, s => s.present);
export const createDeepEqualSelector = createSelectorCreator(defaultMemoize, _.isEqual);

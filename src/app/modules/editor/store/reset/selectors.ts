import { createSelector, getEditorState } from 'app/modules/editor/store/selectors';

const getResetState = createSelector(getEditorState, s => s.reset);
export const isBeingReset = createSelector(getResetState, r => r.isBeingReset);

import { getEditorState } from 'app/pages/editor/store/selectors';
import { createSelector } from 'reselect';

const getResetState = createSelector(getEditorState, s => s.reset);
export const isBeingReset = createSelector(getResetState, r => r.isBeingReset);

import { createSelector, getEditorState } from 'app/modules/editor/store/selectors';

const getGuideState = createSelector(getEditorState, s => s.guides);
export const getGuides = createSelector(getGuideState, g => g.guides);

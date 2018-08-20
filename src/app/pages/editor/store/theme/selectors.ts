import { getEditorState } from 'app/pages/editor/store/selectors';
import { createSelector, createStructuredSelector } from 'reselect';

const getThemeState = createSelector(getEditorState, s => s.theme);
export const getThemeType = createStructuredSelector({
  themeType: createSelector(getThemeState, t => t.themeType),
  isInitialPageLoad: createSelector(getThemeState, t => t.isInitialPageLoad),
});

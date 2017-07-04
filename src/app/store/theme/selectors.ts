import { getAppState } from 'app/store/selectors';
import { createSelector, createStructuredSelector } from 'reselect';

const getThemeState = createSelector(getAppState, s => s.theme);
export const getThemeType = createStructuredSelector({
  themeType: createSelector(getThemeState, t => t.themeType),
  isInitialPageLoad: createSelector(getThemeState, t => t.isInitialPageLoad),
});

import { getAppState } from 'app/store/selectors';
import { createSelector } from 'reselect';

const getThemeState = createSelector(getAppState, s => s.theme);
export const getThemeType = createSelector(getThemeState, t => t.themeType);

import * as actions from './actions';

const STORAGE_KEY_THEME_TYPE = 'storage_key_theme_type';
type ThemeType = 'light' | 'dark';

export interface State {
  readonly themeType: ThemeType;
}

export function buildInitialState() {
  return {
    themeType: window.localStorage.getItem(STORAGE_KEY_THEME_TYPE) || 'light',
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  if (action.type === actions.SET_THEME) {
    const themeType: ThemeType = action.payload.isDarkTheme ? 'dark' : 'light';
    window.localStorage.setItem(STORAGE_KEY_THEME_TYPE, themeType);
    return { ...state, themeType };
  }
  return state;
}

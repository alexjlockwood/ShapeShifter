import * as actions from './actions';

const STORAGE_KEY_THEME_TYPE = 'storage_key_theme_type';
export type ThemeType = 'light' | 'dark';

export interface State {
  readonly themeType: ThemeType;
  readonly isInitialPageLoad: boolean;
}

export function buildInitialState() {
  return {
    themeType: window.localStorage.getItem(STORAGE_KEY_THEME_TYPE) || 'light',
    isInitialPageLoad: true,
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  if (action.type === actions.SET_THEME) {
    const { themeType } = action.payload;
    window.localStorage.setItem(STORAGE_KEY_THEME_TYPE, themeType);
    if (themeType === state.themeType) {
      return state;
    }
    return { ...state, themeType, isInitialPageLoad: false };
  }
  return state;
}
